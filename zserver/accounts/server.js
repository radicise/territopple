/**
 * @file
 * provides authentication services and faciliates requests for account data
 */

const nodemailer = require("nodemailer");
const { SecretData, SensitiveData, AccountId, AuthToken, RotatingCryptoData } = require("./common.js");
const { randomBytes, randomInt } = require("crypto");
const auth = require("./auth.js");
// const db = require("./db.js");
const http = require("http");
const { ensureFile, addLog, logStamp, settings, validateJSONScheme, JSONScheme } = require("../../defs.js");
const mdb = require("mongodb");

const EACCESS = "logs/accounts/access.txt";
const EREJECT = "logs/accounts/rejected.txt";
const ESENSITIVE = "logs/accounts/sensitive.txt"; // used to log sensitive operations (eg. account creation, password change)
const EERROR = "logs/accounts/error.txt";
ensureFile(EACCESS);
ensureFile(EREJECT);
ensureFile(ESENSITIVE);
ensureFile(EERROR);
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

class FatalError extends Error {
    /**
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "FatalError";
    }
}

/**
 * @typedef AccountRecord
 * @type {{_id:mdb.ObjectId,id:string,name:string,email:string,pwdata:mdb.Binary}}
 */

/**
 * processes the unsecured public data fetch operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function processPubFetch(req, res, url, log) {
    /**@type {(op:string)=>void} */
    const notimpl = (op)=>{log(EREJECT, `${op} not implemented`);};
    const stripped = url.pathname.substring(ACC_PUB_PREFIX.length); // strip the public data path prefix
    let target = stripped.substring(1, stripped.indexOf("/", 1));
    let self = false;
    if (target === "%40self") {
        self = true;
        const p = req.headers.cookie.indexOf("sessionId");
        if (p === -1) {
            res.writeHead(403).end();
            return;
        }
        const e = req.headers.cookie.indexOf(";", p+10);
        console.log(req.headers.cookie.substring(p+10, e>0?e:undefined));
        target = SessionManager.getAccountId(req.headers.cookie.substring(p+10, e>0?e:undefined));
        if (!target) {
            res.writeHead(403).end();
            return;
        }
    }
    const resource = stripped.substring(stripped.indexOf("/", 1));
    console.log(`${target} , ${resource}`);
    switch (resource) {
        case "/info": {
            try {
                const v = await collection.findOne({id:target});
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({id:target,name:v.name,email:self?v.email:undefined}));
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
/**@type {Record<string, {id:"email",v:string}>} */
let info_update_info = {};

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

/**
 * @param {string} email
 * @param {string} code_href
 */
async function sendEmailVerification(email, code_href) {
    await mailtransport.sendMail({
        from:`"Automation" <${settings.MAIL_CONFIG.BOT_USER}>`,
        to: email,
        subject: "Email Verification",
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
    if (url.pathname === "/acc/dbg") {
        SessionManager.debug();
        res.writeHead(200).end();
        return;
    }
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
    console.log(req.headers["content-type"]);
    console.log(req.headers["sec-fetch-site"]);
    if (req.headers["content-type"] !== "application/json" || req.headers["sec-fetch-site"] !== "same-origin") {
        res.writeHead(400).end();
        return;
    }
    console.log(req.headers.cookie);
    // AUTHENTICATION NOT IMPLEMENTED
    const body = req.method === "GET"?"":await new Promise((r, s) => {
        let d = "";
        req.on("data", (data) => {d += data});
        req.on("end", ()=>r(d));
        req.on("error", s);
    });
    switch (req.method) {
        case "GET":{return;}
        case "POST":{
            if (url.pathname === "/acc/login") {
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
                        res.writeHead(200, {"Set-Cookie":`sessionId=${SessionManager.createSession(data.id)}; Same-Site=Lax; Secure; HttpOnly; Path=/`}).end();
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
            return;
        }
        case "DELETE":{
            // VERIFY THAT SENDER IS LOGGED IN AS TARGET USER
            notimpl("account deletion");
            res.writeHead(501).end();
            return;
        }
        case "PUT":{
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
                    await collection.insertOne(info);
                    res.writeHead(200).end(info.id);
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
                    if (!data.email.endsWith("@territopple.net")) {
                        res.writeHead(200).end();
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
                    account_creation_info[code] = {id:data.id,name:data.name,email:data.email,pwdata:auth.makePwData(data.pw),timeoutid:setTimeout(()=>{delete account_creation_info[code];}, 600000)};
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
                case "/acc/email": {
                    notimpl("email change");
                    res.writeHead(501).end();
                    return;
                }
                case "/acc/password": {
                    notimpl("password change");
                    res.writeHead(501).end();
                    return;
                }
                case "/acc/name": {
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, accNameChangeScheme)) {
                        res.writeHead(400).end();
                        return;
                    }
                    const p = req.headers.cookie.indexOf("sessionId");
                    if (p === -1) {
                        res.writeHead(403).end();
                        return;
                    }
                    const e = req.headers.cookie.indexOf(";", p+10);
                    if (!SessionManager.verifySession(req.headers.cookie.substring(p+10, e>0?e:undefined), data.id)) {
                        res.writeHead(403).end();
                        return;
                    }
                    try {
                        await collection.updateOne({id:data.id}, {"$set":{name:data.name}});
                        res.writeHead(200).end();
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
const internal_server = http.createServer((req, res) => {});

class SessionManager {
    /**@type {Record<string,[string,number]>} */
    static #sessions = {};
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
        const token = randomBytes(32).toString("base64url");
        this.#sessions[id] = [token,setTimeout(()=>{this.#expireToken(id);}, 1000*60*30)];
        return token;
    }
    /**
     * @param {string} sessionid
     * @returns {string}
     */
    static getAccountId(sessionid) {
        return this.#sessions[sessionid][0];
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
        if (!(id in this.#sessions)) return;
        clearTimeout(this.#sessions[id][1]);
        this.#sessions[id][1] = setTimeout(()=>{this.#expireToken(id);}, 1000*60*30);
    }
    /**
     * @param {string} id
     */
    static #expireToken(id) {
        delete this.#sessions[id];
    }
    static debug() {
        console.log(this.#sessions);
    }
}

public_server.listen(settings.AUTHPORT);
internal_server.listen(settings.AUTHINTERNALPORT);
public_server.on("error", async (err) => {
    if (err instanceof FatalError) {
        await client.close();
        throw err;
    }
});
internal_server.on("error", async (err) => {
    if (err instanceof FatalError) {
        await client.close();
        throw err;
    }
});
