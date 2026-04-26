/**
 * @file
 * this file manages the profile pictures collection
 */


const { settings, validateJSONScheme } = require("../../../defs.js");
const { AccountRecord, PFPRecord } = require("../types.js");
const { check_permission, Permissions } = require("../perms.js");
const http = require("http");
const { mdb, pfp_data, getEffectivePrivs, getAccountRecord, client, collection } = require("../db.js");
const { SessionManager, extractSessionId } = require("../sessions.js");
const { ACC_PFP_UPLOAD_TIMEOUT } = require("../constants.js");
const schemes = require("../schemes.js");

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
 * @returns {Promise<"OKAY"|"PFPDISABLE"|"NOTRUST"|"TOOYOUNG">}
 */
async function PFPUpdateAllowed(acr) {
    if (!settings.PFPS?.ENABLED) {
        return "PFPDISABLE";
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
    return "OKAY";
}

/**
 * @param {AccountRecord} acr
 * @param {http.IncomingMessage} req
 * @returns {Promise<"OKAY"|"PFPDISABLE"|"NOTRUST"|"TOOYOUNG"|"TOOBIG"|"NOLENGTH"|"NOTYPE"|"BADTYPE">}
 */
async function PFPUploadAllowed(acr, req) {
    // console.log(acr);
    if (!settings.PFPS?.ENABLED) {
        return "PFPDISABLE";
    }
    if (!req.headers["content-type"]) {
        return "NOTYPE";
    }
    if (!req.headers["content-length"]) {
        return "NOLENGTH";
    }
    if (!(req.headers["content-type"] in extensionMap)) {
        return "BADTYPE";
    }
    if (settings.PFPS?.RESTRICT) {
        if (settings.PFPS.RESTRICT.TRUSTED) {
            if (!check_permission(await getEffectivePrivs(acr), Permissions.TRUSTED)) {
                console.log(await getEffectivePrivs(acr));
                return "NOTRUST";
            }
        }
        if (settings.PFPS.RESTRICT.AGE) {
            if ((Date.now()-acr.cdate)/1000 < MIN_AGE) {
                return "TOOYOUNG";
            }
        }
    }
    if (Number(req.headers["content-length"]) > MAX_SIZE) {
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
        const acr = await getAccountRecord(accid);
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
                if (totallen !== Number(req.headers["content-length"])) {
                    // console.log(`${totallen} != ${req.headers["content-length"]}`);
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
        await pfp_data.insertOne({_id:id,data:Buffer.concat(imgdata),type:req.headers["content-type"],refcount:0,src:accid});
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
 * @param {string} pfpid
 * @param {http.ServerResponse} res
 */
async function fetchPFP(pfpid, res) {
    try {
        let filter;
        if (pfpid[0] === "&") {
            filter = {src:pfpid.slice(1)};
        } else {
            const nsid = pfpid.slice(0,pfpid.indexOf("."));
            if (!mdb.ObjectId.isValid(nsid)) {
                res.writeHead(400).end("bad image id");
                return;
            }
            const id = mdb.ObjectId.createFromHexString(nsid);
            filter = {_id:id};
        }
        /**@type {PFPRecord} */
        const document = await pfp_data.findOne(filter);
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

/**
 * @param {string} accid
 * @param {string} pfpid
 * @param {http.ServerResponse} res
 */
async function handlePFPChangeRequest(accid, pfpid, res) {
    try {
        const acr = await getAccountRecord(accid);
        if (acr === null) {
            res.writeHead(404).end("account id not found");
            return;
        }
        switch (await PFPUpdateAllowed(acr)) {
            case "NOTRUST": {
                res.writeHead(403).end("this is a trusted feature");
                return;
            }
            case "TOOYOUNG": {
                res.writeHead(403).end(`this feature has a minimum age requirement of ${min_age_string}`);
                return;
            }
            case "PFPDISABLE": {
                res.writeHead(403).end("pfps are not enabled");
                return;
            }
            case "OKAY": {
                break;
            }
        }
        const nsnid = pfpid.slice(0,pfpid.indexOf("."));
        const nsoid = acr.pfp ? acr.pfp.slice(0,acr.pfp.indexOf(".")) : null;
        if (!mdb.ObjectId.isValid(nsnid)) {
            res.writeHead(400).end("invalid pfp");
            return;
        }
        const rnpfpid = mdb.ObjectId.createFromHexString(nsnid);
        if (pfp_data.countDocuments({_id:rnpfpid}) === 0) {
            res.writeHead(404).end("pfp not found");
            return;
        }
        let success = true;
        await client.withSession(async (session) => {
            try {
                await session.withTransaction(async () => {
                    if (mdb.ObjectId.isValid(nsoid)) {
                        await pfp_data.updateOne({_id:mdb.ObjectId.createFromHexString(nsoid)},{"$inc":{refconut:-1}});
                    }
                    await pfp_data.updateOne({_id:rnpfpid},{"$inc":{refcount:1}});
                    await collection.updateOne({id:accid},{"$set":{pfp:pfpid}});
                });
            } catch (E) {
                console.log(E);
                success = false;
            }
        });
        if (!success) {
            res.writeHead(500).end("unable to update pfp");
            return;
        }
        res.writeHead(200).end("pfp updated successfully");
        return;
    } catch (E) {
        console.log(E);
        res.writeHead(500).end("internal server error");
        return;
    }
}

/**
 * processes profile picture operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function handlePFPRequest(req, res, url, log) {
    // console.log(url);
    switch (url.pathname) {
        case "/acc/pfp/upload": {
            if (req.method !== "POST") {
                res.writeHead(405).end("uploading profile images requires use of the POST method");
                return;
            }
            try {
                await handlePFPUploadRequest(req, res);
            } catch (E) {
                console.log(E);
                res.writeHead(500).end();
            }
            return;
        }
        case "/acc/pfp/change": {
            if (req.method !== "PATCH") {
                res.writeHead(405).end("changing profile images requires use of the PATCH method");
                return;
            }
            try {
                const body = await new Promise((r, s) => {
                    let d = "";
                    req.on("data", (data) => {d += data});
                    req.on("end", ()=>r(d));
                    req.on("error", s);
                });
                const data = JSON.parse(body);
                if (!validateJSONScheme(data, schemes.updatePFPScheme)) {
                    res.writeHead(400).end();
                    return;
                }
                const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
                if (!accid) {
                    res.writeHead(403).end("must be logged in");
                    return;
                }
                await handlePFPChangeRequest(accid, data.pfp, res);
            } catch (E) {
                console.log(E);
                res.writeHead(500).end();
            }
            return;
        }
        case "/acc/pfp/get": {
            if (req.method !== "GET") {
                res.writeHead(405).end("getting profile images requires use of the GET method");
                return;
            }
            let target = url.searchParams.get("tar");
            if (target === null) {
                res.writeHead(400).end("must supply a target account");
                return;
            }
            if (target === "%40self") {
                const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
                if (accid === null) {
                    if (settings.PFPS?.DEFAULT_PFP) {
                        await fetchPFP("&&guest", res);
                        return;
                    }
                } else {
                    target = accid;
                }
            }
            await fetchPFP(target, res);
            return;
        }
        default: {
            res.writeHead(404).end("endpoint not found");
            return;
        }
    }
}

exports.handlePFPRequest = handlePFPRequest;
// exports.handlePFPUploadRequest = handlePFPUploadRequest;
// exports.handlePFPGetRequest = handlePFPGetRequest;
// exports.handlePFPChangeRequest = handlePFPChangeRequest;
