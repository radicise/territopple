const fs = require("fs");
const path = require("path");
const { PluginModule, HandlerState, GlobalRecord, EmitFunction, OnFunction, ClearFunction } = require("../types.js");

/**
 * PLUGIN NOTES:
 * files with the same name but different sequences of extensions
 * will cause collisions
 * eg: 'a.js' and 'a.exe.js' will cause a collision
 * this should not happen anyway since you're an idiot if you make those files
 */

/**
 * @returns {Record<string, PluginModule>}
 */
function getPlugins() {
    /**@type {Record<string, PluginModule>} */
    let record = {};
    fs.readdirSync(__dirname).filter(v => v.endsWith(".js")&&!v.startsWith("plugin")).forEach((v) => {
        record[v.slice(0, v.indexOf("."))] = require(`./${v}`).plugin;
    });
    return record;
}
const plugins = getPlugins();
/**@type {GlobalRecord} */
let globals = {};
/**@type {EmitFunction} */
let emit;
/**@type {OnFunction} */
let on;
/**@type {ClearFunction} */
let clear;

/**
 * @param {string} plugin
 */
function pluginit(plugin) {
    if (plugins[plugin]._inited) return;
    plugins[plugin]._inited = true;
    const _tag = `plug:${plugin}`;
    plugins[plugin]._tag = _tag;
    // on(_tag, "@deinit", (_,tag) => {
    //     if (tag === _tag) {
    //         for (const k in plugins[plugin]) {
    //             clear(`${_tag}:${k}`);
    //         }
    //     }
    // });
    plugins[plugin].initlisten({on:(name, cb)=>{on(_tag,name,cb);},emit:(name,data)=>{emit(_tag,name,data)},emitraw:emit,_tag:_tag});
}
/**
 * @param {string} plugin
 * @param {HandlerState} state
 */
function activate(plugin, state) {
    const _tag = plugins[plugin]._tag;
    plugins[plugin].activate(state,{on:(name, cb)=>{on(_tag,name,cb);},emit:(name,data)=>{emit(_tag,name,data)},emitraw:emit,_tag});
}
/**
 * @param {string} plugin
 * @param {string} target
 * @param {HandlerState} state
 * @returns {any}
 */
function invoke(plugin, target, state) {
    const _tag = plugins[plugin]._tag;
    return plugins[plugin][target](state);
}

/**
 * sets the object available to all plugins
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
function getGlobals() {
    return globals;
}

exports.plugins = plugins;
exports.setGlobals = setGlobals;
exports.getGlobals = getGlobals;
exports.pluginit = pluginit;
exports.activate = activate;
exports.invoke = invoke;
