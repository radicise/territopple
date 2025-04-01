/**
 * @file
 * this file contains all encryption related functionality
 */

const { privateDecrypt, publicEncrypt, createCipheriv, createDecipheriv, createECDH } = require("crypto");
const { rotatingCryptoData, SensitiveData, AuthToken } = require("./common.js");

function createSymmetricKey() {
    createECDH();
}
