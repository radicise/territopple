/**
 * @file
 * this file contains the JS interface for communicating with the auth server
 */

const http = require("http");
const { settings } = require("../../defs.js");
const { attatchListeners, InterfaceReturn } = require("./common.js");

class AuthServer {
    static Public = class {}
    static Internal = class {
        /**
         * @param {string} sessid
         * @returns {Promise<InterfaceReturn<void>>}
         */
        static sessionKeepalive(sessid) {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${settings.AUTHINTERNALPORT}/session-keepalive?id=${sessid}`, {method:"GET"});
                attatchListeners(req, resolve);
            });
        }
        /**
         * @param {string} sessid
         * @returns {Promise<InterfaceReturn<string>>}
         */
        static resolveSession(sessid) {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${settings.AUTHINTERNALPORT}/resolve-session?id=${sessid}`, {method:"GET"});
                attatchListeners(req, resolve, (data) => data);
            });
        }
        /**
         * @param {string} sessid
         * @returns {Promise<InterfaceReturn<Buffer>>}
         */
        static getPerms(sessid) {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${settings.AUTHINTERNALPORT}/perms?id=${sessid}`, {method:"GET"});
                attatchListeners(req, resolve, (data) => Buffer.from(data, "base64url"));
            });
        }
    }
}

exports.AuthServer = AuthServer;
