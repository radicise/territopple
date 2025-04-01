/**
 * @file
 * types, objects, and functions required for interoperability between parts of the account system
 */

const { nbytes } = require("../../defs");
const { randomBytes } = require("crypto");

/**
 * container class for data that must never be sent without encryption
 * @template T
 */
class SensitiveData {
    /**ensures that any attempt to stringify this will fail */
    #json_fail;
    /**@type {T} */
    #data;
    /**
     * @param {T} data
     */
    constructor(data) {
        this.#data = data;
        this.#json_fail = this;
    }
    /**
     * returns the data in encrypted form
     * @param {(data:T)=>Buffer} encryptor
     * @returns {Buffer}
     */
    encrypt(encryptor) {
        return encryptor(this.#data);
    }
}

class AccountId {
    /**
     * @param {number} data
     */
    constructor(data) {
        this.data = data;
        this.buffer = Buffer.from(nbytes(data, 8));
    }
}

class AuthToken {
    /**
     * @param {...number|string|Buffer} fields
     */
    constructor(...fields) {
        this.data = fields.map(v => typeof v === "string" ? "s"+Buffer.from(v).toString("base64url") : (typeof v === "number" ? "n"+Buffer.from(nbytes(v, 8)).toString("base64url") : "b"+v.toString("base64url"))).map(v => (v.length-1).toString(16).padStart(3,"0")+v).join("");
    }
    /**
     * @param {string|Buffer} data
     * @returns {(number|string|Buffer)[]}
     */
    static parse(data) {
        if (typeof data !== "string") {
            data = data.toString("ascii");
        }
        let i = 0;
        const f = [];
        while (i < data.length) {
            // console.log(`${i}\n${data}\n${data.slice(i)}`);
            const l = Number.parseInt(data.slice(i, i + 3), 16);
            i += 3;
            const t = data[i];
            i += 1;
            const d = Buffer.from(data.slice(i, i+l), "base64url");
            i += l;
            // console.log(d);
            // console.log(l);
            // console.log(t);
            f.push(t === "s" ? d.toString("utf-8") : (t === "n" ? Number(d.readBigInt64BE()) : d));
        }
        return f;
    }
}

/**
 * a parameter that expires and is regenerated on fixed intervals
 * @template T
 */
class ExpiringParam {
    /**@type {number}@description timer id */
    #tid;
    /**@type {number}@description time that the last expiration occurred */
    #swapped_time;
    /**@type {T}@description current value */
    #cvalue;
    /**@type {T}@description last value */
    #lvalue;
    /**@type {()=>T} */
    #generator;
    /**@type {number} */
    #interval;
    /**
     * @param {number} interval in minutes (NOTE: the actual time before expiring will be in the range interval-2*interval if a time parameter is passed to getValue, if it is not passed, actual time before expiring will be in the range 0-interval)
     * @param {()=>T} generator generates new value
     */
    constructor(interval, generator) {
        this.#tid = null;
        this.#generator = generator;
        this.#interval = interval*60000;
        this.#swapped_time = null;
        this.#cvalue = null;
        this.#lvalue = null;
        this.expire();
    }
    /**
     * forces the current value to expire immediately
     * resets the expiration timer
     */
    expire() {
        if (this.#tid !== null) {
            clearTimeout(this.#tid);
        }
        this.#swapped_time = Date.now();
        this.#lvalue = this.#cvalue;
        this.#cvalue = this.#generator();
        this.#tid = setTimeout(()=>{this.#timeExpire();}, this.#interval);
    }
    /**
     * @param {number?} time the time that the value was first accessed
     * @returns {T}
     */
    getValue(time) {
        if (time !== undefined && time < this.#swapped_time) {
            if (this.#lvalue === null) return this.#cvalue;
            return this.#lvalue;
        }
        return this.#cvalue;
    }
    #timeExpire() {
        this.#tid = null;
        this.expire();
    }
}

/**
 * @param {number} n
 * @returns {()=>Buffer}
 */
function boundRandomBytes(n) {
    return () => {return randomBytes(n);};
}

const RotatingCryptoData = class {
    static #quickAuthBase = new ExpiringParam(0.5, boundRandomBytes(32));
    /**
     * acts as a form of salt for quick authentication tokens
     */
    static get quickAuthBase() {
        return this.#quickAuthBase;
    }
};

const PEPPERS = {
    get passwords() {
        return Buffer.of();
    }
};

exports.SensitiveData = SensitiveData;
exports.AccountId = AccountId;
exports.AuthToken = AuthToken;
exports.RotatingCryptoData = RotatingCryptoData;
exports.PEPPERS = PEPPERS;
