/**
 * @file
 * provides authentication services and faciliates requests for account data
 */

const nodemailer = require("nodemailer");
const { SecretData, SensitiveData, AccountId, AuthToken, RotatingCryptoData } = require("./common.js");
const { randomBytes, randomInt, sign, generateKeyPair } = require("crypto");
const auth = require("./auth.js");
const { mdb, client, getEffectivePrivs, collection, priv_groups } = require("./db.js");
const http = require("http");
const { ensureFile, addLog, logStamp, settings, validateJSONScheme, assembleByte } = require("../../defs.js");
// const mdb = require("mongodb");
const fs = require("fs");
const path = require("path");
const { AppealRejectionRecord, SanctionRecord, AccountRecord, checkFlag, FlagF1, PrivGroupRecord } = require("./types.js");
const { check_permission, Permissions, check_can_moderate, check_sanction_allowed } = require("./perms.js");
const { SessionManager, ASessionManager, makeSessionCookie, makeASessionCookie, extractSessionId, extractASessionId } = require("./sessions.js");
const schemes = require("./schemes.js");
const { ACC_CREAT_TIMEOUT, ACC_PWRST_TIMEOUT, ACC_MAX_NAME_LEN, EACCESS, EREJECT, ESENSITIVE, EERROR, IACCESS, EBADMOD, ACC_PUB_PREFIX, ACC_ADMIN_PREFIX, ACC_PFP_PREFIX } = require("./constants.js");

const { processPubFetch } = require("./handlers/pub_fetch.js");
const { processAdminFetch } = require("./handlers/admin_fetch.js");
const { handlePFPRequest } = require("./colls/pfps.js");

{
    const PID_FILE = path.join(settings.DEVOPTS?.pid_dir??path.join(process.env.HOME, "serv-pids"), "auth.pid");
    ensureFile(PID_FILE);
    fs.writeFileSync(PID_FILE, process.pid.toString());
}
// fs.writeFileSync(path.join(settings.DEVOPTS?.pid_dir??path.join(process.env.HOME, "serv-pids"), "auth.pid"), process.pid.toString());

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
    if (url.pathname.startsWith(ACC_PFP_PREFIX)) {
        await handlePFPRequest(req, res, url, log);
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
                    if (!validateJSONScheme(data, schemes.accLoginScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accPWResetScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accPWResetCodeScheme)) {
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
                    if (!validateJSONScheme(data, schemes.friendReqScheme)) {
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
                    if (!validateJSONScheme(data, schemes.friendReqScheme)) {
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
                    if (!validateJSONScheme(data, schemes.appealScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accCreationScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accPWChangeScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accFlagsChangeScheme)) {
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
                    if (!validateJSONScheme(data, schemes.accNameChangeScheme)) {
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
        case "/perms":{
            if (req.method !== "GET") {
                res.writeHead(405).end();
                return;
            }
            if (url.searchParams.get("id") === null) {
                res.writeHead(400).end("NO ID");
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
                        res.writeHead(404).end("ID NOT FOUND");
                        return;
                    }
                    const groups = await priv_groups.find({gid:{$in:(rec.priv_groups??[]).filter(v=>!(v&0x80000000))}}).project({privs:1}).toArray();
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
                res.writeHead(404).end("NO SESSION");
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
                    const groups = await priv_groups.find({gid:{$in:(rec.priv_groups??[]).filter(v=>!(v&0x80000000))}}).project({privs:1}).toArray();
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
