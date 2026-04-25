const mdb = require("mongodb");

const { settings } = require("../../defs.js");
const { AccountRecord } = require("./types.js");

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
const pfp_data = db.collection("pfps");

/**
 * @param {AccountRecord} rec
 * @returns {Promise<number>}
 */
async function getEffectivePrivs(rec) {
    const groups = await priv_groups.find({gid:{$in:rec.priv_groups?.filter(v=>!(v&0x80000000))??[]}}).project({privs:1}).toArray();
    return (rec.priv_level | groups.reduce((pv, cv) => pv | cv.privs, 0));
}

class AccountNotFoundError extends Error {
    /**
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "AccountNotFoundError";
    }
}

/**
 * @param {string} accid
 * @param {boolean} dothrow if true this function will throw if the account is not found
 * @returns {Promise<AccountRecord>}
 */
async function getAccountRecord(accid, dothrow) {
    /**@type {AccountRecord} */
    const rec = accid ? await collection.findOne({id:target}) : null;
    if (rec === null) {
        if (dothrow) {
            throw new AccountNotFoundError(`ACCOUNT '${accid}' NOT FOUND`);
        }
        return null;
    }
    return rec;
}

exports.mdb = mdb;
exports.client = client;
exports.db = db;
exports.collection = collection;
exports.priv_groups = priv_groups;
exports.pfp_data = pfp_data;
exports.getEffectivePrivs = getEffectivePrivs;

exports.AccountNotFoundError = AccountNotFoundError;
exports.getAccountRecord = getAccountRecord;
