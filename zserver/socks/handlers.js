// const { handle: playHandle } = require("./play.js");
const fs = require("fs");
const { SocketHandler, DataRecord, GlobalRecord, EmitFunction, OnFunction, ClearFunction, CheckFunction, HandlerInvocationError } = require("../types.js");
const plugin = require("../extmeta/plugin.js");

/**
 * @returns {Record<string, SocketHandler>}
 */
function getHandlers() {
    /**@type {Record<string, SocketHandler>} */
    let record = {};
    fs.readdirSync(__dirname).filter(v => !v.startsWith("handlers")).forEach((v) => {
        const mod = require(`./${v}`);
        mod.plugins?.forEach(v=>plugin.pluginit(v));
        record[v.slice(0, v.indexOf("."))] = mod.handler;
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
/**@type {CheckFunction} */
let tag_inuse;
let tagcount = 0;

/*
PECULIARITIES/PITFALLS in the handler system:
Due to oddities in how EventTarget.removeListener works, EventTarget.removeAllListeners must be used instead.
As a result, sockets given to the handler system have listeners bound to message, close, and error that forward
these events to _message, _close, and _error, which have all listeners cleared whenever "change" is called.

In order to efficiently delete event all listeners within event system associated with a subscriber,
tags are used to mark the owner of a subscription.
Handlers generate these tags using "sock:handler:[n]" where 'n' is a number incremented every time a handler is generated

INTERNAL CODE (code that is either a handler or the handler system itself):
DO NOT: attatch handlers before "state.game" is set to a non-nullish value.

EXTERNAL CODE (code that is neither a handler or the handler system itself):
DO NOT: remove all listeners on message, close, or error.
DO NOT: rely on listeners attatched to _message, _close, or _error.
*/

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
    if (!sock.HANDLER_INIT) {
        sock.HANDLER_INIT = true;
        sock.on("close", (...a)=>{sock.emit("_close",...a)});
        sock.on("error", (...a)=>{sock.emit("_error",...a)});
        sock.on("message", (...a)=>{sock.emit("_message",...a)});
    }
    let HOLDING = false;
    let callbuf = null;
    let cbuf = [];
    let ebuf = [];
    let messageL;
    let closeL;
    let errorL;
    const genTag = __tag || `sock:handler:${tagcount++}`;
    tagcount %= 100_000_000;
    if (!__tag) {
        if (tag_inuse(genTag)) {
            emit(genTag, "?tagcollide");
            emit(genTag, "?fatalerr", {"#gameid":state.game?.ident,"source":"?tagcollide"});
            sock.terminate();
        }
        on(genTag, "?tagcollide", (_, tag) => {
            if (tag === genTag) {
                emit(genTag, "?fatalerr", {"#gameid":state.game?.ident,"source":"?tagcollide"});
                // emit(`${genTag}:plug`, "@deinit");
                clear(genTag);
                sock.terminate();
            }
        });
    }
    state.tag = genTag;
    let __ = () => {HOLDING = true;}
    let ___ = () => {
        HOLDING = false;
        if (callbuf) {
            sock.removeAllListeners("_message");
            sock.removeAllListeners("_close");
            sock.removeAllListeners("_error");
            // if (messageL) sock.removeListener("message", messageL);
            // if (closeL) sock.removeListener("close", closeL);
            // if (errorL) sock.removeListener("error", errorL);
            clear(genTag);
            sock.removeListener("HOLD", __);
            sock.removeListener("CONT", ___);
            handle(callbuf[0], sock, callbuf[1], state, genTag);
        } else {
            ebuf.forEach(v => errorL(...v));
            ebuf = [];
            cbuf.forEach(v => closeL(...v));
            cbuf = [];
        }
    }
    sock.addEventListener("HOLD", __);
    sock.addEventListener("CONT", ___);
    let m = handlers[name](sock, globals, {change:(name, args) => {
        if (HOLDING) {
            if (!callbuf) {
                callbuf = [name, args];
            }
        }
        sock.removeAllListeners("_message");
        sock.removeAllListeners("_close");
        sock.removeAllListeners("_error");
        // if (messageL) sock.removeListener("message", messageL);
        // if (closeL) sock.removeListener("close", closeL);
        // if (errorL) sock.removeListener("error", errorL);
        clear(genTag);
        sock.removeListener("HOLD", __);
        sock.removeListener("CONT", ___);
        handle(name, sock, args, state, genTag);
    }, emit:(name, data) => {data=data??{};data["#gameid"]=state.game?.ident??"!pregame";emit(genTag, name, data);}, onall:(name, cb) => {on(genTag, name, (data, tag) => {if (data["#gameid"]===state.game.ident)cb(data, tag);});}, on:(name, cb) => {on(genTag, name, (data, tag) => {if (data["#gameid"]===state.game.ident&&tag!==genTag)cb(data, tag);});}, activateplug:(plug)=>{plugin.activate(plug, state);}, invokeplug:(plug, target)=>{plugin.invoke(plug, target, state);}}, args||{}, state);
    if (m.invokeError) {
        throw new HandlerInvocationError(m.invokeError);
    }
    messageL = m.messageL;
    closeL = m.closeL;
    errorL = m.errorL;
    if (messageL) sock.on("_message", (...a) => {if(!HOLDING)messageL(...a);});
    if (errorL) sock.on("_error", (...a) => {if(!HOLDING)errorL(...a);else ebuf.push(a);});
    if (closeL) sock.on("_close", (...a) => {if(!HOLDING)closeL(...a);else cbuf.push(a);});
    // if (!(messageL || errorL || closeL)) {
    //     emit(`${genTag}:plug`, "@deinit");
    // }
    return genTag;
}

/**
 * sets the object available to all handlers
 * @param {GlobalRecord} value
 * @param {EmitFunction} emitf
 * @param {OnFunction} onf
 * @param {ClearFunction} clearf
 * @param {CheckFunction} tag_inusef
 */
function setGlobals(value, emitf, onf, clearf, tag_inusef) {
    globals = value;
    emit = emitf;
    on = onf;
    clear = clearf;
    tag_inuse = tag_inusef;
    plugin.setGlobals(value, emitf, onf, clearf);
}
function getGlobals() {
    return globals;
}

exports.handlers = handlers;
exports.handle = handle;
exports.setGlobals = setGlobals;
exports.getGlobals = getGlobals;
