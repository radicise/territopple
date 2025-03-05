const { Id, Account } = require("./account.js");
const { hash } = require("crypto");

/**
 * checks if the given password matches the hash stored in the account data
 * @param {Account} account
 * @param {string} password
 * @returns {boolean}
 */
function checkPassword(account, password) {
    return hash("sha512", `${account.salt}${password}`, "buffer").equals(account.password);
}
