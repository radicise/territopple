const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const { SESS_TIMEOUT } = require("./constants.js");

/**@type {Record<string, object>} */
let account_creation_info = {};
/**@type {Record<string, {id:string,timeoutid:string}>} */
let info_update_info = {};

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

exports.account_creation_info = account_creation_info;
exports.info_update_info = info_update_info;

exports.makeSessionCookie = makeSessionCookie;
exports.makeASessionCookie = makeASessionCookie;
exports.extractSessionId = extractSessionId;
exports.extractASessionId = extractASessionId;

exports.SessionManager = SessionManager;
exports.ASessionManager = ASessionManager;
