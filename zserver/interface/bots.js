/**
 * @file
 * this file contains the JS interface for communicating with the bot server
 */

const http = require("http");
const { settings } = require("../../defs.js");
const { attatchListeners, InterfaceReturn } = require("./common.js");

class BotServer {
    /**
     * @param {string} gameid
     * @param {string} botname
     * @param {string} authkey
     * @param {string} playernum
     * @returns {Promise<InterfaceReturn<void>>}
     */
    static addBot(gameid, botname, authkey, playernum) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.BOTPORT}/${gameid}/${botname}?k=${authkey}${playernum}`, {method: "GET"});
            attatchListeners(req, resolve);
        });
    }
}

exports.BotServer = BotServer;
