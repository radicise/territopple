// const { handle: playHandle } = require("./play.js");
const fs = require("fs");
const { SocketHandler, DataRecord, GlobalRecord, EmitFunction, OnFunction, ClearFunction } = require("../types");

/**
 * @returns {Record<string, SocketHandler>}
 */
function getHandlers() {
    /**@type {Record<string, SocketHandler>} */
    let record = {};
    fs.readdirSync(__dirname).filter(v => !v.startsWith("handlers")).forEach((v) => {
        record[v.slice(0, v.indexOf("."))] = require(`./${v}`).handler;
    });
    return record;
}
const handlers = getHandlers();
/**@type {GlobalRecord} */
let globals = {};
/**@type {EmitFunction} */
let emit;
/**@type {OnFunction} */
let on;
/**@type {ClearFunction} */
let clear;
let tagcount = 0;

/**
 * registers a connection handler and returns the generated event tag
 * 
 * this tag is preserved across handler changes, and can be used to uniquely identify a connection
 * @param {string} name handler name
 * @param {import("ws").WebSocket} sock
 * @param {DataRecord?} args arguments to pass through
 * @param {DataRecord?} state state that is meant to be preserved through handler changes
 * @param {undefined} __tag PRIVATE, DO NOT PROVIDE THIS ARGUMENT
 * @returns {string}
 */
/*
 * @ param {{emit:(name: string, data?: DataRecord) => void,on:(name: string, cb: (data: DataRecord) => void) => void}} _
 * @ param {(name: string, data?: DataRecord) => void} emit
 * @ param {(name: string, cb: (data: DataRecord) => void) => void} on
 */
function handle(name, sock, args, state, __tag) {
    let messageL;
    let closeL;
    let errorL;
    const genTag = __tag || `sock:handler:${tagcount++}`;
    state.tag = genTag;
    let m = handlers[name](sock, globals, {change:(name, args) => {
        if (messageL) sock.removeListener("message", messageL);
        if (closeL) sock.removeListener("close", closeL);
        if (errorL) sock.removeListener("error", errorL);
        clear(genTag);
        handle(name, sock, args, state, genTag);
    }, emit:(name, data) => {data=data??{};data["#gameid"]=state.game?.ident??"!pregame";emit(genTag, name, data);}, onall:(name, cb) => {on(genTag, name, (data, tag) => {if (data["#gameid"]===state.game.ident)cb(data, tag);});}, on:(name, cb) => {on(genTag, name, (data, tag) => {if (data["#gameid"]===state.game.ident&&tag!==genTag)cb(data, tag);});}}, args||{}, state);
    messageL = m.messageL;
    closeL = m.closeL;
    errorL = m.errorL;
    return genTag;
}

/**
 * sets the object available to all handlers
 * @param {GlobalRecord} value
 * @param {EmitFunction} emitf
 * @param {OnFunction} onf
 * @param {ClearFunction} clearf
 */
function setGlobals(value, emitf, onf, clearf) {
    globals = value;
    emit = emitf;
    on = onf;
    clear = clearf;
}

exports.handlers = handlers;
exports.handle = handle;
exports.setGlobals = setGlobals;
