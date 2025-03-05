
/**
 * @typedef Id
 * @type {number}
 */

class Account {
    /**
     * @param {Id} id unique account id
     * @param {string} name display name
     * @param {Id[]} friends list of friended accounts' ids
     * @param {number} salt password salt
     * @param {Buffer} password hash of salted password
     */
    constructor (id, name, friends, salt, password) {
        /**@type {Id} */
        this.id = id;
        /**@type {string} */
        this.name = name;
        /**@type {Id[]} */
        this.friends = friends;
        /**@type {number} */
        this.salt = salt;
        /**@type {Buffer} */
        this.password = password;
    }
}

exports.Id = this.Id;
exports.Account = Account;
