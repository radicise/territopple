/**
 * @file
 * this file contains all encryption related functionality
 */

const { privateDecrypt, publicEncrypt, generateKeySync, generateKeyPairSync, createCipheriv, createDecipheriv, createECDH, createPublicKey, hash, KeyObject, publicDecrypt } = require("crypto");
const { SecretData } = require("./common.js");

// const ECNAME = "secp256r1";

function createSecretSymmetricKey() {
    return new SecretData({kind:"encryption-key",algo:"aes"}, generateKeySync("aes", {length:256}));
}
function generateSecretKeyPair() {
    const pkey = generateKeyPairSync("rsa", {modulusLength:2048});
    return {privateKey:new SecretData({kind:"encryption-key",algo:"rsapri"}, pkey),publicKey:createPublicKey(pkey)};
}

/**
 * @param {SecretData} key
 * @param {Buffer} data
 * @returns {Buffer}
 */
function secretSymmetricEncrypt(key, data) {
    return key.use("CIPHER", data);
}
/**
 * @param {SecretData} key
 * @param {Buffer} data
 * @returns {Buffer}
 */
function secretSymmetricDecrypt(key, data) {
    return key.use("DECIPHER", data);
}

/**
 * @param {SecretData} key
 * @param {Buffer} data
 * @returns {Buffer}
 */
function secretPrivateDecrypt(key, data) {
    return key.use("DECRYPT", data);
}
/**
 * @param {SecretData} key
 * @param {Buffer} data
 * @returns {Buffer}
 */
function secretPrivateEncrypt(key, data) {
    return key.use("ENCRYPT", data);
}

/**
 * @param {SecretData} key
 * @param {Buffer} data
 * @returns {Buffer}
 */
function secretSignature(key, data) {
    return secretPrivateEncrypt(key, hash("sha512", data));
}
/**
 * @param {KeyObject} key
 * @param {Buffer} data
 * @param {Buffer} sign
 * @returns {boolean}
 */
function verifySignature(key, data, sign) {
    return hash("sha512", data, "buffer").equals(publicDecrypt(key, sign));
}

exports.createSecretSymmetricKey = createSecretSymmetricKey;
exports.generateSecretKeyPair = generateSecretKeyPair;
exports.secretSymmetricEncrypt = secretSymmetricEncrypt;
exports.secretSymmetricDecrypt = secretSymmetricDecrypt;
exports.secretPrivateEncrypt = secretPrivateEncrypt;
exports.secretPrivateDecrypt = secretPrivateDecrypt;
exports.secretSignature = secretSignature;
exports.verifySignature = verifySignature;
