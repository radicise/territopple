/**
 * @file
 * standalone authentication functionality
 */

const { hash, createHash, randomBytes, getHashes } = require("crypto");
const { SecurityError, nbytes } = require("../../defs.js");
const { AccountId, AuthToken, SensitiveData, RotatingCryptoData } = require("./common.js");
const HASH_ALGORITHM = "sha512";

if (!getHashes().includes(HASH_ALGORITHM)) {
    throw new SecurityError("account authentication requires that sha512 be available");
}

/**
 * token to quickly authenticate a user
 * this token must only be used to quickly authenticate that a websocket connection is logged in as the given account
 * @param {AccountId} accountId
 * @returns {SensitiveData<AuthToken>}
 */
function createQuickAuthToken(accountId) {
    let time = Date.now();
    let base = RotatingCryptoData.quickAuthBase.getValue(time);
    let h = saltedHash(base, Buffer.from(nbytes(time, 8)), accountId.buffer);
    return new SensitiveData(new AuthToken(time, accountId.buffer, h));
}
/**
 * requires a decrypted token string
 * @param {string|Buffer} token
 * @returns {boolean}
 */
function verifyQuickAuthToken(token) {
    let fields = AuthToken.parse(token);
    let time = fields[0];
    let aid = fields[1];
    let h = fields[2];
    let base = RotatingCryptoData.quickAuthBase.getValue(time);
    let test = saltedHash(base, Buffer.from(nbytes(time, 8)), aid);
    return test.equals(h);
}

/**
 * @param {Buffer|bigint} salt
 * @param {...Buffer|string} data
 * @returns {Buffer}
 */
function saltedHash(salt, ...data) {
    let saltb = salt;
    if (typeof salt === "bigint") {
        saltb = Buffer.allocUnsafe(8);
        saltb.writeBigInt64BE(salt);
    }
    const h = createHash(HASH_ALGORITHM);
    h.update(saltb);
    data.forEach(d => h.update(d));
    return h.digest();
}

/**
 * generates salt and returns [salt, hasheddata]
 * @param {Buffer|string} data
 * @returns {[Buffer, Buffer]}
 */
function convertDataToHash(data) {
    const salt = randomBytes(8);
    const h = createHash(HASH_ALGORITHM);
    h.update(salt);
    h.update(data);
    return [salt, h.digest()];
}

/**
 * verifies that the salted hash of the input data matches the data to be checked against
 * @param {Buffer} checkdata
 * @param {Buffer|string} inputdata
 * @param {Buffer|bigint} salt
 * @returns {boolean}
 */
function verifyAccountPassword(checkdata, inputdata, salt) {
    // let saltb = salt, inputdatab = inputdata;
    // if (typeof inputdata === "string") {
    //     inputdatab = Buffer.from(inputdata);
    // }
    // if (typeof salt === "bigint") {
    //     saltb = Buffer.allocUnsafe(8);
    //     saltb.writeBigInt64BE(salt);
    // }
    // return checkdata.equals(hash(HASH_ALGORITHM, Buffer.concat([saltb, inputdatab]), "buffer"));
    return checkdata.equals(saltedHash(salt, inputdata));
}

exports.saltedHash = saltedHash;
exports.convertDataToHash = convertDataToHash;
exports.verifyAccountPassword = verifyAccountPassword;
exports.createQuickAuthToken = createQuickAuthToken;
exports.verifyQuickAuthToken = verifyQuickAuthToken;
