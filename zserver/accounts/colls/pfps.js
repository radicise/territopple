/**
 * @file
 * this file manages the profile pictures collection
 */


const { settings } = require("../../../defs.js");
const { AppealRejectionRecord, SanctionRecord, AccountRecord, checkFlag, FlagF1, PrivGroupRecord } = require("../types.js");
const { check_permission, Permissions, check_can_moderate, check_sanction_allowed } = require("../perms.js");
const http = require("http");
const { mdb, pfp_data, getEffectivePrivs, getAccountRecord } = require("../db.js");
const { SessionManager, extractSessionId } = require("../sessions.js");
const { ACC_PFP_UPLOAD_TIMEOUT } = require("../constants.js");

const allowedTypes = ["image/jpeg","image/png","image/svg+xml"];
const extensionMap = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
};

const sizeUnits = (size) => {return size[0]*{"B":1,"K":1000,"M":1000000}[size[1]];};
const ageUnits = (age) => {return age[0]*{"s":1,"m":60,"h":3600,"d":86400,"w":604800,"M":2592000,"y":31536000}[age[1]];};

const MAX_SIZE = sizeUnits(settings.PFPS?.MAX_SIZE ?? [0,"B"]);
const MIN_AGE = ageUnits(settings.PFPS?.RESTRICT?.AGE ?? [0,"s"]);
const min_age_string = ((a)=>`${a[0]}${{"s":"seconds","m":"minutes","h":"hours","d":"days","w":"weeks","M":"months","y":"years"}[a[1]]}`)(settings.PFPS?.RESTRICT?.AGE??[0,"s"]);

if (MAX_SIZE > 15000000) {
    console.error("CONFIGURATION ERROR: IMPLEMENTATION DETAILS PREVENT IMAGES LARGER THAN 15MB");
    process.exit(1);
}

/**
 * @param {AccountRecord} acr
 * @param {http.IncomingMessage} req
 * @returns {Promise<"OKAY"|"PFPDISABLE"|"NOTRUST"|"TOOYOUNG"|"TOOBIG"|"NOLENGTH"|"NOTYPE"|"BADTYPE">}
 */
async function PFPUploadAllowed(acr, req) {
    if (!settings.PFPS?.ENABLED) {
        return "PFPDISABLE";
    }
    if (!req.headers["content-type"]) {
        return "NOTYPE";
    }
    if (!req.headers["content-length"]) {
        return "NOLENGTH";
    }
    if (!allowedTypes.includes(req.headers["content-type"])) {
        return "BADTYPE";
    }
    if (settings.PFPS?.RESTRICT) {
        if (settings.PFPS.RESTRICT.TRUSTED) {
            if (!check_permission(await getEffectivePrivs(acr), Permissions.TRUSTED)) {
                return "NOTRUST";
            }
        }
        if (settings.PFPS.RESTRICT.AGE) {
            if ((Date.now()-acr.cdate)/1000 < MIN_AGE) {
                return "TOOYOUNG";
            }
        }
    }
    if (req.headers["content-length"] > MAX_SIZE) {
        return "TOOBIG";
    }
    return "OKAY";
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handlePFPUploadRequest(req, res) {
    try {
        const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
        const acr = getAccountRecord(accid);
        if (acr === null) {
            res.writeHead(404).end("account not found");
            return;
        }
        switch (await PFPUploadAllowed(acr, req)) {
            case "PFPDISABLE": {
                res.writeHead(403).end("pfps are not enabled");
                return;
            }
            case "NOTRUST": {
                res.writeHead(403).end("this feature requires trusted access");
                return;
            }
            case "TOOYOUNG": {
                res.writeHead(403).end(`this feature has a minimum account age of ${min_age_string}`);
                return;
            }
            case "TOOBIG": {
                res.writeHead(413).end("image data too large");
                return;
            }
            case "NOLENGTH": {
                res.writeHead(411).end("length required");
                return;
            }
            case "NOTYPE": {
                res.writeHead(415).end("mime type required");
                return;
            }
            case "BADTYPE": {
                res.writeHead(415).end("unsupported image type");
                return;
            }
            case "OKAY": {
                break;
            }
        }
        const imgdata = [];
        let totallen = 0;
        /**@type {Promise<"OKAY"|"LENGTHMISMATCH"|"ABORT">} */
        const gate1 = new Promise(r => {
            req.on("data", (chunk) => {
                imgdata.push(chunk);
                totallen += chunk.length;
            });
            req.once("end", () => {
                if (totallen !== req.headers["content-length"]) {
                    r("LENGTHMISMATCH");
                    return;
                }
                req.removeAllListeners();
                r("OKAY");
            });
            req.once("error", () => {
                req.removeAllListeners();
                r("ABORT");
            });
        });
        switch (await gate1) {
            case "LENGTHMISMATCH": {
                res.writeHead(400).end("length mismatch");
                return;
            }
            case "ABORT": {
                res.writeHead(400).end("connection error");
                return;
            }
            case "OKAY": {
                break;
            }
        }
        const id = new mdb.ObjectId(mdb.ObjectId.generate());
        const pfpid = `${id.toHexString()}.${extensionMap[req.headers["content-type"]]}`;
        await pfp_data.insertOne({_id:id,data:Buffer.concat(imgdata),type:req.headers["content-type"],refcount:0});
        setTimeout(()=>{
            pfp_data.deleteOne({_id:id,refcount:0});
        },ACC_PFP_UPLOAD_TIMEOUT);
        res.writeHead(200).end(pfpid);
        return pfpid;
    } catch (E) {
        console.log(E);
        res.writeHead(500).end("internal server error");
        return;
    }
}

/**
 * @typedef PFPRecord
 * @type {{_id:mdb.ObjectId,data:Buffer,type:string,refcount:number}}
 */

/**
 * @param {string} accid
 * @param {http.ServerResponse} res
 */
async function handlePFPGetRequest(accid, res) {
    try {
        /**@type {AccountRecord} */
        const acr = await getAccountRecord(accid);
        if (acr === null) {
            res.writeHead(404).end("account not found");
            return;
        }
        const pfpid = acr.pfp ? acr.pfp : (settings.ACC?.DEFAULT_PFP ?? ".");
        const nsid = pfpid.slice(0,pfpid.indexOf("."));
        if (!mdb.ObjectId.isValid(nsid)) {
            res.writeHead(400).end("bad image id");
            return;
        }
        const id = mdb.ObjectId.createFromHexString(nsid);
        /**@type {PFPRecord} */
        const document = await pfp_data.findOne({_id:id});
        if (document === null) {
            res.writeHead(404).end("pfp not found");
            return;
        }
        res.writeHead(200,{"content-length":document.data.length,"content-type":document.type});
        const hwm = res.writableHighWaterMark;
        let cur = 0;
        while (cur < document.data.length) {
            res.write(document.data.subarray(cur, cur+hwm));
            cur += hwm;
            await new Promise(r => res.once("drain",r));
        }
        res.end();
        return;
    } catch (E) {
        console.log(E);
        res.writeHead(500).end("internal server error");
        return;
    }
}

exports.handlePFPUploadRequest = handlePFPUploadRequest;
exports.handlePFPGetRequest = handlePFPGetRequest;
