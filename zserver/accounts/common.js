/**
 * @file
 * types, objects, and functions required for interoperability between parts of the account system
 */

const { nbytes, SecurityError } = require("../../defs.js");
const { randomBytes, privateEncrypt, KeyObject, createCipheriv, createDecipheriv, privateDecrypt } = require("crypto");

/**
 * @typedef EncryptorId
 * @type {string}
 */

class Encryptors {
    static #identity = (v) => v;
    static get identity() {
        return this.#identity;
    }
    static {
        if (this.#identity) {
            console.log("WARNING: identity encryptor function is exposed");
        }
    }
}

/**
 * See principle 4 and 5
 * container class for data that must never be sent without encryption
 * @template T
 */
class SensitiveData {
    /**
     * private field ensures that serialization attempts fail
     * @type {T}
     */
    #data;
    /**
     * @param {T} data
     */
    constructor(data) {
        this.#data = data;
    }
    /**
     * returns the data in encrypted form
     * using an id here ensures that an identity function could not be used to leak data
     * @param {EncryptorId} encryptor
     * @returns {Buffer}
     */
    encrypt(encryptor) {
        return Encryptors[encryptor](this.#data);
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

/**
 * See principles 4 and 6
 * ensures that cryptographic state cannot be overwritten
 */
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

/**
 * @typedef SecretDataType
 * @type {{kind:"encryption-key",algo:"aes"|"rsapri"}|{kind:"plaintext-password"}}
 */

/**
 * @param {SecretDataType} type
 */
function validateSecretType(type) {
    if (!type.kind) throw new Error();
    switch (type.kind) {
        case "encryption-key":
            if (!type.algo) throw new Error();
            switch (type.algo) {
                case "aes":case "rsapri":break;
                default:throw new Error();
            }
        case "plaintext-password":
            break;
        default:
            throw new Error();
    }
}

/**
 * See principles 4 and 6
 * allows the server to isolate direct references to secrets
 */
class SecretData {
    /**
     * the type is obfuscated to prevent potential attacks from knowing what method to use to attempt to discover the secret
     * @type {SecretDataType}
     */
    #type;
    #data;
    /**
     * @param {SecretDataType} type
     */
    constructor(type, data) {
        validateSecretType(type);
        this.#type = type;
        this.#data = data;
    }
    #validateParams(...args) {
        if (args.some(v => typeof v === "function")) {
            throw new SecurityError("functions are not allowed as parameters of SecretData.use");
        }
        let failed = false;
        switch (this.#type.kind) {
            case "encryption-key":{
                switch (this.#type.algo) {
                    case "rsapri":
                    case "aes":
                        args.forEach(v => {
                            if(!(
                                typeof v === "string"||
                                Buffer.isBuffer(v)||
                                (
                                    v instanceof SecretData&&!(
                                        // aes encryption is prevented from sending private rsa keys
                                        this.#type.algo==="aes"&&v.#type.kind==="encryption-key"&&v.#type.algo==="rsapri"
                                    )
                                )))
                                failed=true;
                        });
                        break;
                }
                break;
            }
        }
        if (failed) {
            throw new Error("failed");
        }
    }
    #buffer() {
        switch (this.#type.kind) {
            case "encryption-key":{
                switch (this.#type.algo) {
                    case "aes":
                        /**@type {KeyObject} */
                        const k = this.#data;
                        return k.export({"format":"der","type":"spki"});
                    default:
                        throw new SecurityError();
                }
            }
        }
    }
    use(...args) {
        this.#validateParams(...args);
        switch (this.#type.kind) {
            case "encryption-key":{
                switch (this.#type.algo) {
                    case "rsapri":{
                        if (args[0] === "DECRYPT") {
                            return privateDecrypt(this.#data, Buffer.concat(args.map((v,i) => i===0?Buffer.of():typeof v === "string"?Buffer.from(v):Buffer.isBuffer(v)?v:v.#buffer())));
                        }
                        if (args[0] === "ENCRYPT") {
                            return privateEncrypt(this.#data, Buffer.concat(args.map((v,i) => i===0?Buffer.of():typeof v === "string"?Buffer.from(v):Buffer.isBuffer(v)?v:v.#buffer())));
                        }
                        throw new Error("bad input");
                    }
                    case "aes":{
                        if (args[0] === "CIPHER") {
                            const c = createCipheriv("aes-256-gcm", this.#data, null);
                            args.forEach(v => c.update(typeof v === "string"?Buffer.from(v):Buffer.isBuffer(v)?v:v.#buffer()));
                            return c.final();
                        }
                        if (args[0] === "DECIPHER") {
                            const d = createDecipheriv("aes-256-gcm", this.#data, null);
                            args.forEach(v => d.update(typeof v === "string"?Buffer.from(v):Buffer.isBuffer(v)?v:v.#buffer()));
                            return d.final();
                        }
                        throw new Error("bad input");
                    }
                }
            }
        }
    }
}

exports.SensitiveData = SensitiveData;
exports.AccountId = AccountId;
exports.AuthToken = AuthToken;
exports.SecretData = SecretData;
exports.RotatingCryptoData = RotatingCryptoData;
exports.PEPPERS = PEPPERS;
