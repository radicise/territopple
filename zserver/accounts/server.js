/**
 * @file
 * provides authentication services and faciliates requests for account data
 */

const nodemailer = require("nodemailer");
const { SecretData, SensitiveData, AccountId, AuthToken, RotatingCryptoData } = require("./common.js");
const { randomBytes, randomInt, sign, generateKeyPair } = require("crypto");
const auth = require("./auth.js");
// const db = require("./db.js");
const http = require("http");
const { ensureFile, addLog, logStamp, settings, validateJSONScheme, assembleByte, JSONScheme } = require("../../defs.js");
const mdb = require("mongodb");
const fs = require("fs");
const path = require("path");
const { AppealRejectionRecord, SanctionRecord, AccountRecord, checkFlag, FlagF1, PrivGroupRecord } = require("./types.js");
const { check_permission, Permissions, check_can_moderate, check_sanction_allowed } = require("./perms.js");

fs.writeFileSync(path.join(process.env.HOME, "serv-pids", "auth.pid"), process.pid.toString());

const ACC_CREAT_TIMEOUT = settings.ACC?.CREATE_TO ?? 600000;
const SESS_TIMEOUT = settings.ACC?.SESSION_TO ?? 1000*60*60*24;
const ACC_PWRST_TIMEOUT = settings.ACC?.PWRST_TO  ?? 600000;
const ACC_MAX_NAME_LEN = settings.ACC?.NAME_MAX ?? 25;

const EACCESS = "logs/accounts/access.txt";
const EREJECT = "logs/accounts/rejected.txt";
const ESENSITIVE = "logs/accounts/sensitive.txt"; // used to log sensitive operations (eg. account creation, password change)
const EERROR = "logs/accounts/error.txt";
const IACCESS = "logs/accounts/iaccess.txt";
const EBADMOD = "logs/accounts/ebadmod.txt";
ensureFile(EBADMOD);
ensureFile(IACCESS);
ensureFile(EACCESS);
ensureFile(EREJECT);
ensureFile(ESENSITIVE);
ensureFile(EERROR);
logStamp(EBADMOD);
logStamp(IACCESS);
logStamp(EACCESS);
logStamp(EREJECT);
logStamp(ESENSITIVE);
logStamp(EERROR);

if (!settings.DB_CONFIG?.URI) {
    throw new Error("no database uri");
}
if (!(settings.MAIL_CONFIG?.HOST && settings.MAIL_CONFIG?.BOT_PASS && settings.MAIL_CONFIG?.BOT_USER)) {
    throw new Error("no email config");
}
const client = new mdb.MongoClient(settings.DB_CONFIG.URI);
const db = client.db("accounts");
const collection = db.collection("basic-info");
const priv_groups = db.collection("priv-groups");

const mailtransport = nodemailer.createTransport({
    host: settings.MAIL_CONFIG.HOST,
    port: 465,
    secure: true,
    auth: {
        user: settings.MAIL_CONFIG.BOT_USER,
        pass: settings.MAIL_CONFIG.BOT_PASS
    },
    requireTLS: false,
    tls: {
        rejectUnauthorized: false
    }
});

let IREQNUM_CNT = 0;
let EREQNUM_CNT = 0;

const ACC_PUB_PREFIX = "/acc/pub";
const ACC_ADMIN_PREFIX = "/acc/admin";

class FatalError extends Error {
    /**
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "FatalError";
    }
}
class SanitizedError extends Error {
    /**
     * @param {String} message - error message
     * @param {string} sanitized - sanitized error message
     */
    constructor (message, sanitized) {
        super(message);
        this.name = "SanitizedError";
        this.sanitized = sanitized ?? message;
    }
}

/**
 * @\typedef AccountRecord
 * @\type {{_id:mdb.ObjectId,id:string,name:string,email:string,pwdata:mdb.Binary}}
 */

/**
 * @param {string} cookie
 * @returns {string|null}
 */
function extractSessionId(cookie) {
    if (!cookie) return null;
    let p = cookie.indexOf("; sessionId");
    if (p === -1) {
        if (cookie.startsWith("sessionId")) {
            p = 0;
        } else {
            return null;
        }
    } else {
        p += 2;
    }
    const e = cookie.indexOf(";", p+10);
    return cookie.substring(p+10, e>0?e:undefined);
}

/**
 * @param {string} cookie
 * @returns {string|null}
 */
function extractASessionId(cookie) {
    if (!cookie) return null;
    const p = cookie.indexOf("AsessionId");
    if (p === -1) {
        return null;
    }
    const e = cookie.indexOf(";", p+11);
    return cookie.substring(p+11, e>0?e:undefined);
}

/**
 * processes the unsecured public data fetch operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function processPubFetch(req, res, url, log) {
    if (url.pathname === "/acc/pub/logout") {
        SessionManager.deleteToken(extractSessionId(req.headers.cookie));
        res.writeHead(200).end();
        // res.writeHead(200,{"Set-Cookie":"sessionId=none; Secure; Same-Site=Lax; Http-Only; Path='/'"}).end();
        return;
    }
    if (url.pathname === "/acc/pub/logged-in") {
        if (SessionManager.getAccountId(extractSessionId(req.headers.cookie))) {
            res.writeHead(200).end();
        } else {
            res.writeHead(400).end();
        }
        return;
    }
    //https://territopple.net/acc/pub/list?page=${page||1}&search=${search??"*"}
    if (url.pathname === "/acc/pub/list") {
        const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
        try {
            const search = url.searchParams.get("search") || ".*";
            const page = Number(url.searchParams.get("page")) || 1;
            let pipeline = collection.find().limit(20);
            if (search !== ".*") {
                pipeline = pipeline.filter({$or:[{id:{$regex:search}},{name:{$regex:search}}]});
            }
            pipeline = pipeline.sort({_id:1});
            const list = await (pipeline.skip(20*(page-1)).project({id:1,name:1,cdate:1,last_online:1,friends:1,level:1,incoming_friends:1,outgoing_friends:1,flagf1:1})).toArray();
            if (accid) {
                for (let i = 0; i < list.length; i ++) {
                    list[i].friend = list[i].id===accid?5:(list[i].friends?.includes(accid)?3:(list[i].outgoing_friends?.includes(accid)?2:(list[i].incoming_friends?.includes(accid)?1:0)));
                }
            }
            for (let i = 0; i < list.length; i ++) {
                delete list[i]["friends"];
                delete list[i]["incoming_friends"];
                delete list[i]["outgoing_friends"];
                list[i].odate = list[i].last_online;
                delete list[i]["last_online"];
            }
            res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(list));
        } catch (E) {
            console.log(E);
            res.writeHead(500).end(E.sanitized ?? "Internal Error");
        }
        return;
    }
    /**@type {(op:string)=>void} */
    const notimpl = (op)=>{log(EREJECT, `${op} not implemented`);};
    const stripped = url.pathname.substring(ACC_PUB_PREFIX.length); // strip the public data path prefix
    let target = stripped.substring(1, stripped.indexOf("/", 1));
    // let self = false;
    // if (target === "%40self") {
    //     self = true;
    //     const p = req.headers.cookie.indexOf("sessionId");
    //     if (p === -1) {
    //         res.writeHead(403).end();
    //         return;
    //     }
    //     const e = req.headers.cookie.indexOf(";", p+10);
    //     console.log(req.headers.cookie.substring(p+10, e>0?e:undefined));
    //     target = SessionManager.getAccountId(req.headers.cookie.substring(p+10, e>0?e:undefined));
    //     if (!target) {
    //         res.writeHead(403).end();
    //         return;
    //     }
    // }
    let self = false;
    let rid;
    if (req.headers.cookie) {
        let p = req.headers.cookie.indexOf("; sessionId");
        if (p === -1) {
            if (req.headers.cookie.startsWith("sessionId")) {
                p = 0;
            }
        } else {
            p += 2;
        }
        if (p === -1 && target === "%40self") {
            res.writeHead(403).end("bad cookie");
            return;
        }
        const e = req.headers.cookie.indexOf(";", p+10);
        const me = SessionManager.getAccountId(req.headers.cookie.substring(p+10, e>0?e:undefined));
        rid = me;
        if (target === "%40self") {
            if (!me) {
                res.writeHead(403).end("bad token");
                return;
            }
            target = me;
        }
        if (target === me) {
            self = true;
        }
    }
    const resource = stripped.substring(stripped.indexOf("/", 1));
    // console.log(`${target} , ${resource}`);
    switch (resource) {
        case "/sanction": {
            if (!self) {
                res.writeHead(403).end("can only see own sanctions");
                return;
            }
            try {
                /**@type {AccountRecord} */
                const v = await collection.findOne({id:target});
                v._id;
                const t = Date.now();
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify(v.sanction.filter(v=>!((v.expires<=t&&v.expires!==0)||v.sanction_id&0x20000000)).map(v=>{delete v["notes"];return v;})));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/info": {
            try {
                const v = await collection.findOne({id:target});
                v._id;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({id:target,name:v.name,email:self?v.email:undefined,cdate:v.cdate,last_online:v.last_online,level:v.level,sanction:null,rid,flagf1:v.flagf1??0}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/display-name":{
            try {
                const v = (await collection.findOne({id:target})).name;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({name:v}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/solved":{
            try {
                const v = (await collection.findOne({id:target})).solved;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({solved:v}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/profile-image":{
            notimpl("profile images");
            res.writeHead(501).end();
            return;
        }
        default:{
            log(EERROR, "bad path");
            res.writeHead(404).end();
            return;
        }
    }
}

/**@type {Record<string, object>} */
let account_creation_info = {};
/**@type {Record<string, {id:string,timeoutid:string}>} */
let info_update_info = {};

/**
 * @returns {string}
 */
function generateUpdateCode() {
    let c = randomInt(999999).toString();
    for (let i = 0; i < 10; i ++) {
        if (!(c in account_creation_info)) {
            return c;
        }
        c = randomInt(999999).toString();
    }
    throw new SanitizedError("took too long to generate update code");
}

/**
 * @returns {string}
 */
function generateCreationCode() {
    let c = randomInt(999999).toString();
    for (let i = 0; i < 10; i ++) {
        if (!(c in account_creation_info)) {
            return c;
        }
        c = randomInt(999999).toString();
    }
    throw new Error("took too long to generate creation code");
}

/**@type {JSONScheme} */
const accCreationScheme = {
    "id": "string",
    "name": "string",
    "pw": "string",
    "email": "string"
};
/**@type {JSONScheme} */
const accLoginScheme = {
    "id": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accNameChangeScheme = {
    "id": "string",
    "name": "string"
};
/**@type {JSONScheme} */
const accFlagsChangeScheme = {
    "id": "string",
    "flagf": "number"
};
/**@type {JSONScheme} */
const accPWChangeScheme = {
    "id": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accUpdateScheme = {
    "id": "string",
    "k": "string",
    "v": "string"
};
/**@type {JSONScheme} */
const accPWResetCodeScheme = {
    "code": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accPWResetScheme = {
    "id": "string",
    "email": "string"
};
/**@type {JSONScheme} */
const friendReqScheme = {
    "id": "string"
};
/**@type {JSONScheme} */
const sanctionScheme = {
    "acc": "string",
    "id": "number",
    "bypass": "boolean",
    "value": "number",
    "expires": "number",
    "appeals": "number",
    "notes": "string"
};
/**@type {JSONScheme} */
const appealScheme = {
    "refid": "number",
    "message": "string"
};

/**
 * @param {string} email
 * @param {string} subject
 * @param {string} code_href
 */
async function sendEmailVerification(email, subject, code_href) {
    await mailtransport.sendMail({
        from:`"Automation" <${settings.MAIL_CONFIG.BOT_USER}>`,
        to: email,
        subject: subject,
        text: code_href,
        html: `<a href="${code_href}" target="_blank">${code_href}</a>`
    });
}

/**
 * @param {string} id
 * @returns {string}
 */
function makeSessionCookie(id) {
    return `sessionId=${id}; Same-Site=Lax; Secure; Http-Only; Path=/`;
}
/**
 * @param {string} id
 * @returns {string}
 */
function makeASessionCookie(id) {
    return `AsessionId=${id}; Same-Site=Lax; Secure; Http-Only; Path=/`;
}

// used to process requests for account management and public data fetching
const public_server = http.createServer(async (req, res) => {
    const url = new URL("http://localhost"+req.url);
    const TIME = new Date();
    const REQNUM = EREQNUM_CNT ++;
    /**@type {(p: string, d: string) => void} */
    const log = (p, d) => {addLog(p, `${TIME} - ${REQNUM} - ${d}\n`)};
    /**@type {(op:string)=>void} */
    const notimpl = (op)=>{log(EREJECT, `${op} not implemented`);};
    log(EACCESS, `${req.method} - ${url}`);
    // if (url.pathname === "/acc/dbg") {
    //     SessionManager.debug();
    //     res.writeHead(200).end();
    //     return;
    // }
    // relative paths are never acceptabile
    if (url.pathname.includes(".")) {
        log(EREJECT, "used relative paths");
        res.writeHead(400).end();
        return;
    }
    // ONLY allowed for public data fetch
    if (req.method === "GET" && url.pathname.startsWith(ACC_PUB_PREFIX)) {
        await processPubFetch(req, res, url, log);
        return;
    }
    if (url.pathname.startsWith(ACC_ADMIN_PREFIX)) {
        await processAdminFetch(req, res, url, log);
        return;
    }
    // console.log(req.headers["content-type"]);
    // console.log(req.headers["sec-fetch-site"]);
    if (req.headers["content-type"] !== "application/json" || req.headers["sec-fetch-site"] !== "same-origin") {
        res.writeHead(400).end();
        return;
    }
    // console.log(req.headers.cookie);
    const body = req.method === "GET"?"":await new Promise((r, s) => {
        let d = "";
        req.on("data", (data) => {d += data});
        req.on("end", ()=>r(d));
        req.on("error", s);
    });
    switch (req.method) {
        case "GET":{
            switch (url.pathname) {
                case "/acc/play-auth-token": {
                    res.writeHead(404).end();
                    return;
                }
            }
            return;
        }
        case "POST":{
            switch (url.pathname) {
                case "/acc/login": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accLoginScheme)) {
                        res.writeHead(422).end();
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const doc = await collection.findOne({id:data.id});
                        if (doc === null) {
                            res.writeHead(404).end();
                            return;
                        }
                        if (auth.verifyRecordPassword(doc.pwdata.buffer, data.pw)) {
                            // res.writeHead(200, {"Set-Cookie":`sessionId=${SessionManager.createSession(data.id)}; Same-Site=Lax; Secure; HttpOnly; Path=/`}).end();
                            res.writeHead(200, {"Set-Cookie":makeSessionCookie(SessionManager.createSession(data.id))}).end();
                            try {
                                await collection.updateOne({id:data.id}, {"$set":{last_online:Date.now()}});
                            } catch (E) {
                                console.log(E);
                            }
                            return;
                        } else {
                            res.writeHead(403).end();
                            return;
                        }
                    } catch (E) {
                        log(EERROR, E.toString());
                        res.writeHead(500).end();
                        return;
                    }
                }
                case "/acc/reset-password": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accPWResetScheme)) {
                        res.writeHead(400).end();
                        return;
                    }
                    try {
                        const rec = await collection.findOne({id:data.id});
                        const email = (rec)?.email;
                        if (settings.DEVENV && !rec?.devtst) {
                            res.writeHead(403).end("Account is not a DEVTEST account.");
                            return;
                        }
                        if (data.email !== email) {
                            // console.log(body);
                            // console.log(email);
                            res.writeHead(403).end();
                            return;
                        }
                        const code = generateUpdateCode();
                        info_update_info[code] = {id:data.id,timeoutid:setTimeout(()=>{delete info_update_info[code];},ACC_PWRST_TIMEOUT)};
                        // console.log(info_update_info);
                        await sendEmailVerification(email, "Password Reset", `https://territopple.net/account/reset-password?code=${code}`);
                        res.writeHead(200).end();
                        return;
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                        return;
                    }
                    // res.writeHead(503).end();
                    // return;
                }
                case "/acc/reset-password-wcode": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accPWResetCodeScheme)) {
                        res.writeHead(400).end();
                        return;
                    }
                    if (!(data.code in info_update_info)) {
                        res.writeHead(403).end();
                        return;
                    }
                    try {
                        const info = info_update_info[data.code];
                        // console.log(info);
                        delete info_update_info[data.code];
                        await collection.updateOne({id:info.id},{"$set":{pwdata:auth.makePwData(data.pw)}});
                        res.writeHead(200).end();
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
                case "/acc/unfriend": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, friendReqScheme)) {
                        res.writeHead(400).end("misformatted request");
                        return;
                    }
                    const sessid = extractSessionId(req.headers.cookie);
                    if (!sessid || !SessionManager.getAccountId(sessid)) {
                        res.writeHead(403).end("not logged in");
                        return;
                    }
                    try {
                        const mid = SessionManager.getAccountId(sessid);
                        /**@type {AccountRecord} */
                        const orec = await collection.findOne({id:data.id});
                        if (!orec) {
                            res.writeHead(404).end("account not found");
                            return;
                        }
                        /**@type {AccountRecord} */
                        const mrec = await collection.findOne({id:mid});
                        if (mrec.friends?.includes(data.id)) {
                            await Promise.all([
                                collection.updateOne({id:mid}, {"$pull":{"friends":data.id}}),
                                collection.updateOne({id:data.id}, {"$pull":{"friends":mid}})
                            ]);
                            res.writeHead(200).end();
                            return;
                        } else if (mrec.incoming_friends?.includes(data.id)) {
                            await Promise.all([
                                collection.updateOne({id:mid}, {"$pull":{"incoming_friends":data.id}}),
                                collection.updateOne({id:data.id}, {"$pull":{"outgoing_friends":mid}})
                            ]);
                            res.writeHead(200).end();
                            return;
                        } else if (mrec.outgoing_friends?.includes(data.id)) {
                            await Promise.all([
                                collection.updateOne({id:mid}, {"$pull":{"outgoing_friends":data.id}}),
                                collection.updateOne({id:data.id}, {"$pull":{"incoming_friends":mid}})
                            ]);
                            res.writeHead(200).end();
                            return;
                        } else {
                            res.writeHead(422).end("not friends");
                            return;
                        }
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
                case "/acc/send-friend-request": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, friendReqScheme)) {
                        res.writeHead(400).end("misformatted request");
                        return;
                    }
                    const sessid = extractSessionId(req.headers.cookie);
                    if (!sessid || !SessionManager.getAccountId(sessid)) {
                        res.writeHead(403).end("not logged in");
                        return;
                    }
                    try {
                        const mid = SessionManager.getAccountId(sessid);
                        /**@type {AccountRecord} */
                        const orec = await collection.findOne({id:data.id});
                        if (!orec) {
                            res.writeHead(404).end("account not found");
                            return;
                        }
                        /**@type {AccountRecord} */
                        const mrec = await collection.findOne({id:mid});
                        if (mrec.incoming_friends?.includes(data.id)) {
                            await Promise.all([
                                collection.updateOne({id:data.id},{"$addToSet":{friends:mid},"$pull":{outgoing_friends:mid}}),
                                collection.updateOne({id:mid},{"$addToSet":{friends:data.id},"$pull":{incoming_friends:data.id}})
                            ]);
                        } else {
                            // console.log(`dt:${mrec.devtst}\nof:${orec.flagf1}\nofl:${orec.friends}\nmfl:${mrec.friends}`);
                            // console.log(checkFlag(orec.flagf1, FlagF1.FRIEND_F_STRANGER));
                            // console.log(checkFlag(orec.flagf1, FlagF1.FRIEND_F_FOF));
                            // console.log(orec.friends?.some(v => mrec.friends?.includes(v)));
                            // console.log(!(
                            //     mrec.devtst ||
                            //     !checkFlag(orec.flagf1, FlagF1.FRIEND_F_STRANGER) ||
                            //     (
                            //         !checkFlag(orec.flagf1, FlagF1.FRIEND_F_FOF) &&
                            //         orec.friends?.some(v => mrec.friends?.includes(v))
                            //     )
                            // ));
                            if (
                                !(
                                    mrec.devtst ||
                                    !checkFlag(orec.flagf1, FlagF1.FRIEND_F_STRANGER) ||
                                    (
                                        !checkFlag(orec.flagf1, FlagF1.FRIEND_F_FOF) &&
                                        orec.friends?.some(v => mrec.friends?.includes(v))
                                    )
                                )
                            ) {
                                res.writeHead(403).end();
                                return;
                            }
                            await Promise.all([
                                collection.updateOne({id:data.id},{"$addToSet":{incoming_friends:mid}}),
                                collection.updateOne({id:mid},{"$addToSet":{outgoing_friends:data.id}})
                            ]);
                        }
                        res.writeHead(200).end();
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
                case "/acc/make-appeal": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, appealScheme)) {
                        res.writeHead(400).end("misformatted request");
                        return;
                    }
                    const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
                    if (!accid) {
                        res.writeHead(403).end("not logged in");
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const rec = await collection.findOne({id:accid});
                        /**@type {SanctionRecord} */
                        const sanc = rec.sanction.find(v => v.refid === data.refid);
                        if (!sanc) {
                            res.writeHead(404).end("sanction refid not found");
                            return;
                        }
                        if (!(Date.now()>=sanc.appealable_date && sanc.appeal === null && sanc.appeals_left > 0 && sanc.appealable_date !== 0 && (Date.now()<sanc.expires||sanc.expires===0))) {
                            res.writeHead(403).end("appealing this request is not permitted at this time");
                            return;
                        }
                        if ((await collection.updateOne({id:accid},{"$set":{"sanction.$[a].appeal":data.message,"sanction.$[a].appeal_date":Date.now()},"$inc":{"sanction.$[a].appeals_left":-1}},{arrayFilters:[{"a.refid":{"$eq":data.refid}}]})).modifiedCount) {
                            res.writeHead(200).end();
                            return;
                        }
                        res.writeHead(500).end("unknown failure");
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
            }
            res.writeHead(404).end();
            return;
        }
        case "DELETE":{
            if (settings.DEVENV) {
                res.writeHead(403).end("DEV server has restricted functions");
                return;
            }
            // VERIFY THAT SENDER IS LOGGED IN AS TARGET USER
            notimpl("account deletion");
            res.writeHead(501).end();
            return;
        }
        case "PUT":{
            if (settings.DEVENV) {
                res.writeHead(403).end("DEV server has restricted functions");
                return;
            }
            // notimpl("account creation");
            // res.writeHead(501).end();
            if (url.pathname === "/acc/with-code") {
                console.log("WC");
                console.log(body);
                // VERIFY THAT CODE IS VALID
                if (!(body in account_creation_info)) {
                    res.writeHead(500).end();
                    return;
                }
                try {
                    const info = account_creation_info[body];
                    clearTimeout(account_creation_info[body].timeoutid);
                    delete info["timeoutid"];
                    delete account_creation_info[body];
                    clearTimeout(info.timeoutid);
                    await collection.insertOne(info);
                    res.writeHead(200, {"Set-Cookie":makeSessionCookie(SessionManager.createSession(info.id))}).end(info.id);
                } catch (E) {
                    console.log(E);
                    res.writeHead(500).end();
                }
            } else {
                try {
                    console.log(body);
                    /**@type {{email:string}} */
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accCreationScheme)) {
                        res.writeHead(422).end();
                        return;
                    }
                    // if (!data.email.endsWith("@territopple.net")) {
                    //     res.writeHead(200).end();
                    //     return;
                    // }
                    if (data.id.length > ACC_MAX_NAME_LEN || data.name > ACC_MAX_NAME_LEN) {
                        res.writeHead(422).end("name too long");
                        return;
                    }
                    if ((await collection.findOne({id:data.id})) !== null) {
                        res.writeHead(422).end();
                        return;
                    }
                    const code = generateCreationCode();
                    const code_href = `https://territopple.net/account/do-create?code=${code}`;
                    await mailtransport.sendMail({
                        from:`"Automation" <${settings.MAIL_CONFIG.BOT_USER}>`,
                        to: data.email,
                        subject: "Email Verification",
                        text: code_href,
                        html: `<a href="${code_href}" target="_blank">${code_href}</a>`
                    });
                    account_creation_info[code] = {
                        cdate:Date.now(),
                        last_online:Date.now(),
                        id:data.id,
                        name:data.name,
                        email:data.email,
                        pwdata:auth.makePwData(data.pw),
                        level:0,
                        priv_level:0,
                        sanction:[],
                        timeoutid:setTimeout(()=>{delete account_creation_info[code];}, ACC_CREAT_TIMEOUT)
                    };
                    res.writeHead(200).end();
                } catch (/**@type {Error}*/E) {
                    console.log(E);
                    res.writeHead(503).end();
                }
            }
            return;
        }
        case "PATCH":{
            // VERIFY THAT SENDER IS LOGGED IN AS TARGET USER
            switch (url.pathname) {
                case "/acc/password": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accPWChangeScheme)) {
                        res.writeHead(400).end();
                        return;
                    }
                    const sessid = extractSessionId(req.headers.cookie);
                    if (!sessid || !SessionManager.verifySession(sessid, data.id)) {
                        res.writeHead(403).end();
                        return;
                    }
                    try {
                        if ((await collection.updateOne({id:data.id,devtst:(settings.DEVENV?true:{"$exists":false})}, {"$set":{pwdata:auth.makePwData(data.pw)}})).matchedCount) {
                            res.writeHead(200).end();
                        } else {
                            res.writeHead(403).end("crossing DEV boundary is not allowed");
                        }
                        return;
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end();
                        return;
                    }
                    // notimpl("password change");
                    // res.writeHead(501).end();
                    // return;
                }
                case "/acc/flagf1": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accFlagsChangeScheme)) {
                        res.writeHead(400).end("misformatted request");
                        return;
                    }
                    const sessid = extractSessionId(req.headers.cookie);
                    if (!sessid || !SessionManager.verifySession(sessid, data.id)) {
                        res.writeHead(403).end();
                        return;
                    }
                    try {
                        if ((await collection.updateOne({id:data.id,devtst:(settings.DEVENV?true:{"$exists":false})}, {"$set":{flagf1:data.flagf}})).matchedCount) {
                            res.writeHead(200).end();
                        } else {
                            res.writeHead(403).end("crossing DEV boundary is not allowed");
                        }
                        return;
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end();
                        return;
                    }
                }
                case "/acc/name": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accNameChangeScheme)) {
                        res.writeHead(400).end();
                        return;
                    }
                    if (data.name.length > ACC_MAX_NAME_LEN) {
                        res.writeHead(422).end("name too long");
                        return;
                    }
                    const sessid = extractSessionId(req.headers.cookie);
                    if (!sessid || !SessionManager.verifySession(sessid, data.id)) {
                        res.writeHead(403).end();
                        return;
                    }
                    try {
                        if ((await collection.updateOne({id:data.id,devtst:(settings.DEVENV?true:{"$exists":false})}, {"$set":{name:data.name}})).matchedCount) {
                            res.writeHead(200).end();
                        } else {
                            res.writeHead(403).end("crossing DEV boundary is not allowed");
                        }
                        return;
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end();
                        return;
                    }
                }
            }
            return;
        }
    }
});

/**@type {JSONScheme} */
const adminSancManScheme = {
    "acc": "string",
    "refid": "number",
    "cancel?": "boolean",
    "value?": "number",
    "expires?": "number",
    "notes?": "string",
    "appeal?": "any"
};
/**@type {JSONScheme} */
const adminSancManAppealScheme = {
    "accept": "boolean",
    "notes?": "string",
    "value?": "number"
};
/**@typedef {{acc:string,refid:number,cancel?:boolean,value?:number,expires?:number,notes?:string,appeal?:{accept:boolean,notes?:string,value?:number}}} AdminSancManData */

/**
 * processes the admin fetch operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function processAdminFetch(req, res, url, log) {
    const stripped = url.pathname.substring(ACC_ADMIN_PREFIX.length);
    if (stripped === "/logout") {
        ASessionManager.deleteToken(extractASessionId(req.headers.cookie));
        res.writeHead(200).end();
        return;
    }
    if (stripped === "/check") {
        const id = ASessionManager.getAccountId(extractASessionId(req.headers.cookie))
        if (id) {
            res.writeHead(200).end(JSON.stringify({name:id}));
        } else {
            res.writeHead(400).end();
        }
        return;
    }
    if ((req.headers["content-type"] !== "application/json" || req.headers["sec-fetch-site"] !== "same-origin") && req.method !== "GET") {
        res.writeHead(400).end();
        return;
    }
    const body = req.method === "GET"?"":await new Promise((r, s) => {
        let d = "";
        req.on("data", (data) => {d += data});
        req.on("end", ()=>r(d));
        req.on("error", s);
    });
    if (stripped === "/login") {
        const data = JSON.parse(body);
        if (!validateJSONScheme(data, accLoginScheme)) {
            res.writeHead(422).end();
            return;
        }
        try {
            /**@type {AccountRecord} */
            const doc = await collection.findOne({id:data.id});
            if (doc === null) {
                res.writeHead(404).end();
                return;
            }
            const privs = await getEffectivePrivs(doc);
            if (!check_permission(privs, Permissions.MODERATE)) {
                res.writeHead(403).end("account is not an admin");
                return;
            }
            if (auth.verifyRecordPassword(doc.pwdata.buffer, data.pw)) {
                // res.writeHead(200, {"Set-Cookie":`sessionId=${SessionManager.createSession(data.id)}; Same-Site=Lax; Secure; HttpOnly; Path=/`}).end();
                res.writeHead(200, {"Set-Cookie":makeASessionCookie(ASessionManager.createSession(data.id))}).end();
                return;
            } else {
                res.writeHead(403).end();
                return;
            }
        } catch (E) {
            log(EERROR, E.toString()+`\n${E.stack}`);
            res.writeHead(500).end();
            return;
        }
    }
    const sessid = extractASessionId(req.headers.cookie);
    const accid = ASessionManager.getAccountId(sessid);
    if (!sessid || !accid) {
        res.writeHead(403).end("not logged in");
        return;
    }
    switch (req.method) {
        case "GET":{
            switch (stripped) {
                case "/priv-group-info": {
                    const target = url.searchParams.get("id");
                    if (!target) {
                        res.writeHead(400).end("no target");
                        return;
                    }
                    try {
                        /**@type {PrivGroupRecord} */
                        const rec = await priv_groups.findOne({gid:target});
                        if (!rec) {
                            res.writeHead(404).end("target not found");
                            return;
                        }
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(rec));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                case "/info": {
                    const target = url.searchParams.get("id");
                    if (!target) {
                        res.writeHead(400).end("no target");
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const rec = await collection.findOne({id:target});
                        if (!rec) {
                            res.writeHead(404).end("target not found");
                            return;
                        }
                        delete rec["pwdata"];
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(rec));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
            }
            res.writeHead(404).end();
            return;
        }
        case "POST":{
            switch (stripped) {
                // normal sanction
                case "/Nsanction": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, sanctionScheme)) {
                        res.writeHead(400).end("misformed");
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const source_rec = await collection.findOne({id:accid});
                        const source_privs = await getEffectivePrivs(source_rec);
                        /**@type {AccountRecord} */
                        const target_rec = await collection.findOne({id:data.acc});
                        const target_privs = await getEffectivePrivs(target_rec);
                        if (!check_can_moderate(source_privs, target_privs)) {
                            log(EBADMOD, `'${accid}'->'${data.acc}' (${data.id}) [canmod]`);
                            res.writeHead(403).end("insufficient permissions, this attempt has been logged");
                            return;
                        }
                        if (!check_sanction_allowed(source_privs, data.id)) {
                            log(EBADMOD, `'${accid}'->'${data.acc}' (${data.id}) [sancallow]`);
                            res.writeHead(403).end("insufficient permissions, this attempt has been logged");
                            return;
                        }
                        /**@type {SanctionRecord} */
                        const sobj = {
                            "appeal":null,
                            "appealable_date":data.appeals?(data.expires?data.expires-((data.expires-Date.now())/2):180*86400*1000):0,
                            "appeals_left":data.appeals,
                            "applied":Date.now(),
                            "expires":data.expires,
                            "sanction_id":data.id,
                            "notes":data.notes,
                            "rejections":[],
                            "source":accid,
                            "value":data.value,
                            "appeal_date":0,
                            "appeal_granted":0,
                            "granted_by":null,
                            "refid":target_rec.next_refid
                        };
                        if ((await collection.updateOne({id:data.acc},{"$push":{"sanction":sobj},"$inc":{"next_refid":1}})).modifiedCount) {
                            res.writeHead(200).end();
                            return;
                        }
                        res.writeHead(500).end("unknown failure");
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                default:
                    res.writeHead(404).end();
                    return;
            }
        }
        case "PATCH": {
            switch (stripped) {
                // manage sanction
                case "/Msanction": {
                    /**@type {AdminSancManData} */
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, adminSancManScheme)) {
                        res.writeHead(400).end("misformed man data");
                        return;
                    }
                    if ("appeal" in data && !validateJSONScheme(data.appeal, adminSancManAppealScheme)) {
                        res.writeHead(400).end("misformed appeal man");
                        return;
                    }
                    try {
                        /**@type {SanctionRecord} */
                        const rec = await collection.find({id:data.acc}).project({sanction:{$elemMatch:{refid:data.refid}}}).tryNext();
                        if (rec === null) {
                            res.writeHead(404).end("sanction not found");
                            return;
                        }
                        const upd = {"$set":{},"$bit":{},"$push":{}};
                        const sanction = "sanction.$[a]";
                        if ("cancel" in data) {
                            upd["$bit"][`${sanction}.sanction_id`] = {"and":0x5fffffff,"or":data.cancel?0x20000000:0};
                        }
                        if ("appeal" in data) {
                            if (data.appeal.accept) {
                                upd["$bit"][`${sanction}.sanction_id`] = {"or":0x20000000};
                                upd["$set"][`${sanction}.appeal_granted`] = Date.now();
                                upd["$set"][`${sanction}.granted_by`] = accid;
                            } else {
                                upd["$push"][`${sanction}.rejections`] = {"source":accid,"date":Date.now(),"notes":data.appeal.notes??"<no notes>","value":data.appeal.value??0,"appeal":rec.appeal,"adate":rec.appeal_date};
                                upd["$set"][`${sanction}.appeal`] = null;
                                upd["$set"][`${sanction}.appeal_date`] = 0;
                            }
                        }
                        if ("expires" in data) {
                            upd["$set"][`${sanction}.expires`] = data.expires;
                        }
                        if ("notes" in data) {
                            upd["$set"][`${sanction}.notes`] = data.notes;
                        }
                        if ("value" in data) {
                            upd["$set"][`${sanction}.value`] = data.value;
                        }
                        if ((await collection.updateOne({id:data.acc},upd,{arrayFilters:[{"a.refid":{"$eq":data.refid}}]})).modifiedCount) {
                            res.writeHead(200).end();
                            return;
                        }
                        res.writeHead(500).end("unknown failure");
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
                default:
                    res.writeHead(404).end();
                    return;
            }
        }
    }
}

const internal_server = http.createServer(async (req, res) => {
    const url = new URL("http://localhost"+req.url);
    const TIME = new Date();
    const REQNUM = IREQNUM_CNT ++;
    /**@type {(p: string, d: string) => void} */
    const log = (p, d) => {addLog(p, `${TIME} - ${REQNUM} - ${d}\n`)};
    // /**@type {(op:string)=>void} */
    // const notimpl = (op)=>{log(IREJECT, `${op} not implemented`);};
    log(IACCESS, `${req.method} - ${url}`);
    switch (url.pathname) {
        case "/session-keepalive":{
            if (req.method !== "GET") {
                res.writeHead(405).end();
                return;
            }
            if (SessionManager.refreshSession(url.searchParams.get("id"))) {
                res.writeHead(200).end();
            } else {
                res.writeHead(404).end();
            }
            return;
        }
        case "/add-friend":{
            if (req.method !== "POST") {
                res.writeHead(405).end();
                return;
            }
            res.writeHead(503).end();
            return;
        }
        case "/perms":{
            if (req.method !== "GET") {
                res.writeHead(405).end();
                return;
            }
            if (url.searchParams.get("id") === "%40guest") {
                res.writeHead(200).end(Buffer.alloc(6,0).toString("base64url"));
                return;
            }
            const id = SessionManager.getAccountId(url.searchParams.get("id"));
            if (id) {
                try {
                    /**@type {AccountRecord} */
                    const rec = await collection.findOne({id});
                    if (!rec) {
                        res.writeHead(404).end();
                        return;
                    }
                    const groups = await priv_groups.find({gid:{$in:rec.priv_groups.filter(v=>!(v&0x80000000))}}).project({privs:1}).toArray();
                    const effective_priv = (rec.priv_level | groups.reduce((pv, cv) => pv | cv.privs, 0));
                    const buf = Buffer.alloc(6,0);
                    buf[0] = (rec.sanction?.find(v => v.sanction_id===9)?.value??0)<<4;
                    buf[0] |= (rec.sanction?.find(v => v.sanction_id===8)?.value??0);
                    buf.writeInt32BE(effective_priv, 1);
                    buf[5] = assembleByte(
                        rec.sanction?.some(v=>v.sanction_id===0),
                        rec.sanction?.some(v=>v.sanction_id===1),
                        rec.sanction?.some(v=>v.sanction_id===3),
                        rec.sanction?.some(v=>v.sanction_id===4),
                        rec.sanction?.some(v=>v.sanction_id===10),
                        rec.sanction?.some(v=>v.sanction_id===11)
                    );
                    res.writeHead(200).end(buf.toString("base64url"));
                } catch (E) {
                    console.log(E);
                    res.writeHead(500).end();
                }
            } else {
                res.writeHead(404).end();
            }
            return;
        }
        case "/get-privs":{
            if (req.method !== "GET") {
                res.writeHead(405).end();
                return;
            }
            const id = SessionManager.getAccountId(url.searchParams.get("id"));
            if (id) {
                try {
                    /**@type {AccountRecord} */
                    const rec = await collection.findOne({id});
                    if (!rec) {
                        res.writeHead(404).end();
                        return;
                    }
                    const groups = await priv_groups.find({gid:{$in:rec.priv_groups.filter(v=>!(v&0x80000000))}}).project({privs:1}).toArray();
                    res.writeHead(200).end((rec.priv_level | groups.reduce((pv, cv) => pv | cv.privs, 0)).toString());
                } catch (E) {
                    console.log(E);
                    res.writeHead(500).end();
                }
            } else {
                res.writeHead(404).end();
            }
            return;
        }
        case "/resolve-session":{
            if (req.method !== "GET") {
                res.writeHead(405).end();
                return;
            }
            const id = SessionManager.getAccountId(url.searchParams.get("id"));
            if (id) {
                res.writeHead(200).end(id);
            } else {
                res.writeHead(404).end();
            }
            return;
        }
        case "/add-completed-puzzle":{
            if (req.method !== "PATCH") {
                res.writeHead(405).end();
                return;
            }
            const id = SessionManager.getAccountId(url.searchParams.get("id"));
            const pzvid = Number(url.searchParams.get("pzvid") ?? "NaN");
            if (isNaN(pzvid) ) {
                res.writeHead(400).end();
            }
            if (!id) {
                res.writeHead(401).end();
                return;
            }
            if ((await collection.findOne({id:id})).devtst ^ settings.DEVENV) {
                res.writeHead(403).end();
                return;
            }
            const upd = {$bit:{}};
            upd["$bit"]["solved.$"] = {or:pzvid};
            if ((await collection.updateOne({id:id,solved:{$not:{$elemMatch:{$mod:[0x04000000,pzvid&0x03ffffff]}}}}, {$addToSet:{solved:pzvid}})).matchedCount) res.writeHead(200).end();
            else if ((await collection.updateOne({id:id,solved:{$elemMatch:{$mod:[0x04000000,pzvid&0x03ffffff]}}, upd}))) res.writeHead(200).end();
            // const upd = {};
            // upd[`solved.${puz}`] = mdb.Int32(1<<variant);
            // if ((await collection.updateOne({id:id}, {$inc:upd})).modifiedCount) res.writeHead(200).end();
            else res.writeHead(500).end();
            return;
        }
    }
});

class SessionManager {
    /**@type {Record<string,[string,number]>} */
    static #sessions = {};
    /**@type {Record<string, string>} */
    static #inverse_map = {};
    /**
     * @returns {string}
     */
    static #generateToken() {
        let t;
        do {
            t = randomBytes(32).toString("base64url");
        } while (t in this.#inverse_map);
        return t;
    }
    /**
     * returns base64url encoded token
     * @param {string} id account id to create the token for
     * @returns {string}
     */
    static createSession(id) {
        if (id in this.#sessions) {
            this.refreshSession(id);
            return this.#sessions[id][0];
        }
        const token = this.#generateToken();
        this.#sessions[id] = [token,setTimeout(()=>{this.#expireToken(id);}, SESS_TIMEOUT)];
        this.#inverse_map[token] = id;
        return token;
    }
    /**
     * @param {string} sessionid
     * @returns {string}
     */
    static getAccountId(sessionid) {
        return this.#inverse_map[sessionid];
    }
    /**
     * verifies that the session token corresponds to the given account id
     * @param {string} token
     * @param {string} id
     * @returns {boolean}
     */
    static verifySession(token, id) {
        if (!(id in this.#sessions)) return;
        return this.#sessions[id][0] === token;
    }
    /**
     * @param {string} id
     */
    static refreshSession(id) {
        if (!(id in this.#sessions)) return false;
        clearTimeout(this.#sessions[id][1]);
        this.#sessions[id][1] = setTimeout(()=>{this.#expireToken(id);}, SESS_TIMEOUT);
        return true;
    }
    /**
     * @param {string} token
     */
    static deleteToken(token) {
        if (!(token in this.#inverse_map)) return;
        this.#expireToken(this.#inverse_map[token]);
    }
    /**
     * @param {string} id
     */
    static #expireToken(id) {
        delete this.#inverse_map[this.#sessions[id][0]];
        delete this.#sessions[id];
    }
    static debug() {
        console.log(this.#sessions);
    }
    static save() {
        const o = {"s":Object.entries(this.#sessions).map(v => [v[0], v[1][0]]),"e":Object.entries(account_creation_info)};
        o.e.forEach(v => v[1].timeoutid = null);
        fs.writeFileSync(path.join(process.env.HOME, "sessions.json"), JSON.stringify(o));
        process.exit(1);
    }
    static load() {
        const p = path.join(process.env.HOME, "sessions.json");
        if (!fs.existsSync(p)) return;
        const o = JSON.parse(fs.readFileSync(p));
        fs.unlinkSync(p);
        for (const l of o.e) {
            const k = l[0];
            account_creation_info[k] = l[1];
            account_creation_info[k].timeoutid = setTimeout(()=>{delete account_creation_info[k];}, ACC_CREAT_TIMEOUT);
        }
        for (const l of o.s) {
            this.#sessions[l[0]] = [l[1], setTimeout(()=>{this.#expireToken(l[0]);}, SESS_TIMEOUT)];
            this.#inverse_map[l[1]] = l[0];
        }
    }
}
SessionManager.load();
process.on("SIGINT", ()=>{SessionManager.save();});
// process.on("SIGTERM", SessionManager.save);

/**
 * manages admin login sessions
 * like standard SessionManager, but without sessions being preserved across restarts
 */
class ASessionManager {
    /**@type {Record<string,[string,number]>} */
    static #sessions = {};
    /**@type {Record<string, string>} */
    static #inverse_map = {};
    /**
     * @returns {string}
     */
    static #generateToken() {
        let t;
        do {
            t = randomBytes(32).toString("base64url");
        } while (t in this.#inverse_map);
        return t;
    }
    /**
     * returns base64url encoded token
     * @param {string} id account id to create the token for
     * @returns {string}
     */
    static createSession(id) {
        if (id in this.#sessions) {
            this.refreshSession(id);
            return this.#sessions[id][0];
        }
        const token = this.#generateToken();
        this.#sessions[id] = [token,setTimeout(()=>{this.#expireToken(id);}, SESS_TIMEOUT)];
        this.#inverse_map[token] = id;
        return token;
    }
    /**
     * @param {string} sessionid
     * @returns {string}
     */
    static getAccountId(sessionid) {
        return this.#inverse_map[sessionid];
    }
    /**
     * verifies that the session token corresponds to the given account id
     * @param {string} token
     * @param {string} id
     * @returns {boolean}
     */
    static verifySession(token, id) {
        if (!(id in this.#sessions)) return;
        return this.#sessions[id][0] === token;
    }
    /**
     * @param {string} id
     */
    static refreshSession(id) {
        if (!(id in this.#sessions)) return false;
        clearTimeout(this.#sessions[id][1]);
        this.#sessions[id][1] = setTimeout(()=>{this.#expireToken(id);}, SESS_TIMEOUT);
        return true;
    }
    /**
     * @param {string} token
     */
    static deleteToken(token) {
        if (!(token in this.#inverse_map)) return;
        clearTimeout(this.#sessions[this.#inverse_map[token]][0]);
        this.#expireToken(this.#inverse_map[token]);
    }
    /**
     * @param {string} id
     */
    static #expireToken(id) {
        if (!(id in this.#sessions)) return;
        delete this.#inverse_map[this.#sessions[id][0]];
        delete this.#sessions[id];
    }
}

/**
 * @param {AccountRecord} rec
 * @returns {Promise<number>}
 */
async function getEffectivePrivs(rec) {
    const groups = await priv_groups.find({gid:{$in:rec.priv_groups?.filter(v=>!(v&0x80000000))??[]}}).project({privs:1}).toArray();
    return (rec.priv_level | groups.reduce((pv, cv) => pv | cv.privs, 0));
}


public_server.listen(settings.AUTHPORT);
internal_server.listen(settings.AUTHINTERNALPORT);
public_server.on("error", async (err) => {
    if (err instanceof FatalError) {
        await client.close();
        throw err;
    } else {
        console.log(err);
    }
});
internal_server.on("error", async (err) => {
    if (err instanceof FatalError) {
        await client.close();
        throw err;
    } else {
        console.log(err);
    }
});
