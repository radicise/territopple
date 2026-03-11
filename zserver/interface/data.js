/**
 * @file
 * this file contains the JS interface for communicating with the data server
 */

const http = require("http");
const { settings } = require("../../defs.js");
const { attatchListeners, InterfaceReturn } = require("./common.js");

class DataServer {
    /**
     * @param {string?} setid
     * @returns {Promise<InterfaceReturn<string>>}
     */
    static generateId(setid) {
        return new Promise((resolve) => {
            console.log(`generating for '${setid}'`);
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/room-id?sid=${setid??"@@@@@"}`, {method:"GET"});
            attatchListeners(req, resolve, (data) => data);
            req.end();
        });
    }
    /**
     * @param {string} gameid
     * @returns {Promise<InterfaceReturn<number>>}
     */
    static getWorkerId(gameid) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/worker?id=${gameid}`, {method:"GET"});
            attatchListeners(req, resolve, (data) => Number.parseInt(data));
        });
    }
    /**
     * @param {string} gameid
     * @returns {Promise<InterfaceReturn<void>>}
     */
    static deleteRoom(gameid) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/room?id=${gameid}`, {method:"DELETE"});
            attatchListeners(req, resolve);
        });
    }
    /**
     * @param {number} workerid 
     * @returns {Promise<InterfaceReturn<void>>}
     */
    static deleteWorker(workerid) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/worker?id=${workerid}`, {method:"DELETE"});
            attatchListeners(req, resolve);
        });
    }
    /**
     * @param {string} roomid
     * @param {import("../backend/data_server.js").GameInfo} gameinfo 
     * @returns {Promise<InterfaceReturn<void>>}
     */
    static populateRoomEntry(roomid, gameinfo) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/room-created?id=${roomid}`, {method:"POST"});
            req.end(JSON.stringify(gameinfo));
            attatchListeners(req, resolve);
        });
    }
    /**
     * @param {string} roomid
     * @param {{playing:number,spectating:number,phase:string}} updateinfo
     * @returns {Promise<InterfaceReturn<void>>}
     */
    static updateRoomEntry(roomid, updateinfo) {
        return new Promise((resolve) => {
            const req = http.request(`http://localhost:${settings.INTERNALPORT}/room?id=${roomid}`, {method:"PATCH"});
            req.end(JSON.stringify(updateinfo));
            attatchListeners(req, resolve);
        });
    }
}

exports.DataServer = DataServer;
