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
const collection = db.collection("accounts");

const mailtransport = nodemailer.createTransport({
    host: settings.MAIL_CONFIG.HOST,
    port: 465,
    secure: true,
    auth: {
        user: settings.MAIL_CONFIG.BOT_USER,
        pass: settings.MAIL_CONFIG.BOT_PASS
    }
});

let IREQNUM_CNT = 0;
let EREQNUM_CNT = 0;

const ACC_PUB_PREFIX = "/pub";

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
    const target = stripped.substring(1, stripped.indexOf("/", 1));
    const resource = stripped.substring(stripped.indexOf("/", 1));
    switch (resource) {
        case "/display-name":{
            try {
                const v = (await collection.findOne({id:target})).project({name:1});
                res.writeHead(200).end(v);
            } catch {
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
    if (req.headers["content-type"] !== "application/json" || req.headers["sec-fetch-site"] !== "same-origin") {
        res.writeHead(400).end();
        return;
    }
    // AUTHENTICATION NOT IMPLEMENTED
    const body = req.method === "GET"?"":await new Promise((r, s) => {
        let d = "";
        req.on("data", (data) => {d += data});
        req.on("end", r);
        req.on("error", s);
    });
    switch (req.method) {
        case "GET":{break;}
        case "DELETE":{
            // VERIFY THAT SENDER IS LOGGED IN AS TARGET USER
            notimpl("account deletion");
            res.writeHead(501).end();
            return;
        }
        case "PUT":{
            // notimpl("account creation");
            // res.writeHead(501).end();
            if (url.pathname === "/with-code") {
                // VERIFY THAT CODE IS VALID
                if (!(body in account_creation_info)) {
                    res.writeHead(500).end();
                    return;
                }
                try {
                    const info = account_creation_info[body];
                    clearTimeout(account_creation_info[body][timeoutid]);
                    delete account_creation_info[body];
                    await collection.insertOne(info);
                    res.writeHead(200).end(info.id);
                } catch {
                    res.writeHead(500).end();
                }
            } else {
                try {
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
                        from:`"Automation" <${settings.MAIL_CONFIG.BOT_USER}@${settings.MAIL_CONFIG.HOST}>`,
                        to: data.email,
                        subject: "Email Verification",
                        text: code_href,
                        html: `<a href="${code_href}" target="_blank">${code_href}</a>`
                    });
                    account_creation_info[code] = {id:data.id,name:data.name,email:data.email,pwdata:auth.makePwData(data.pw),timeoutid:setTimeout(()=>{delete account_creation_info[code];}, 600000)};
                    res.writeHead(200).end();
                } catch {
                    res.writeHead(503).end();
                }
            }
            return;
        }
        case "PATCH":{
            // VERIFY THAT SENDER IS LOGGED IN AS TARGET USER
            switch (url.pathname) {
                case "/email": {
                    notimpl("email change");
                    res.writeHead(501).end();
                    return;
                }
                case "/password": {
                    notimpl("password change");
                    res.writeHead(501).end();
                    return;
                }
            }
            return;
        }
    }
});
const internal_server = http.createServer((req, res) => {});

class SessionManager {
    static #sessions = {};
    /**
     * returns base64url encoded token
     * @returns {string}
     */
    static createSession() {
        const token = randomBytes(32).toString("base64url");
        this.#sessions[token] = Buffer.alloc(1);
    }
    static verifySession() {}
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
