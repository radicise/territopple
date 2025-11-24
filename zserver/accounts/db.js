/**
 * @file
 * functions for database interactions
 */

const { settings } = require("../../defs.js");
const mdb = require("mongodb");

if (settings.DB_CONFIG.URI === null) {
    throw new Error("no database uri");
}
/**
 * @typedef _CDATA
 * @type {{0:mdb.MongoClient,1:mdb.Db,2:mdb.Collection<mdb.Document>}}
 */

// const client = new MongoClient(settings.DB_CONFIG.URI);

/**
 * creates an account entry
 * returns true if successful
 * @param {_CDATA} _cdata
 * @param {Buffer} id
 * @param {Buffer} pwdata
 * @param {string} displayname
 * @param {string} email
 * @returns {boolean}
 */
async function createAccount(_cdata, id, pwdata, name, email) {
    try {
        await _cdata[2].insertOne({id,pwdata,name,email});
        return true;
    } catch {
        return false;
    }
}

/**
 * opens the database connection
 * @returns {object}
 */
function createConnection() {
    const client = new mdb.MongoClient(settings.DB_CONFIG.URI);
    const db = client.db("accounts");
    const collection = db.collection("accounts");
    return [client, db, collection];
}

