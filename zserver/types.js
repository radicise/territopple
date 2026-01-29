const { Game, HostingSettings } = require("../defs");

/**
 * @typedef {{on:TaggedOnFunction,emit:TaggedEmitFunction,emitraw:EmitFunction,_tag:string}} _PMEVAPI
 * @typedef PluginModule
 * @type {Record<string,(state: HandlerState,_:_PMEVAPI)=>void>&{_tag:string,_inited:boolean,activate:(state: HandlerState,_:_PMEVAPI)=>void,initlisten:(_:_PMEVAPI)=>void}}
 */

/**
 * @typedef DataRecord
 * @type {Record<string,unknown>}
 */
/**
 * @typedef GlobalState
 * @type {{
 * MAX_DIM:number,
 * MIN_DIM:number,
 * MIN_PLAYERS:number,
 * MAX_PLAYERS:number,
 * games:Record<string,Game>,
 * saveReplays:boolean,
 * topology:typeof import("../topology/topology.js")
 * }}
 */
/**
 * @typedef GlobalRecord
 * @type {{state:GlobalState,settings:HostingSettings}}
 */

/**
 * @typedef HandlerState
 * @type {{tag:string,game?:Game,playerNum:number,spectating?:boolean,spectatorId?:string,accId?:string,isHost?:boolean}}
 */

//, emit: (name: string, data?: DataRecord) => {void}, on: (name: string, cb: (data: DataRecord) => {void}) => {void}
/**
 * @typedef SocketHandler
 * @type {(sock: import("ws").WebSocket, globals: GlobalRecord, _:{change: (to: string, args?: DataRecord) => void, emit: TaggedEmitFunction, onall: TaggedOnFunction, on: TaggedOnFunction, activateplug: (plug: string)=>void, invokeplug: (plug: string, target: string)=>any}, args: DataRecord, state: HandlerState) => {messageL?:()=>any,closeL?:()=>any,errorL?:()=>any,invokeError?:string}}
 */
/**
 * @typedef TaggedEmitFunction
 * @type {(name: string, data?: DataRecord) => void}
 */
/**
 * @typedef EmitFunction
 * @type {(tag: string, name: string, data?: DataRecord) => void}
 */
/**
 * @typedef TaggedOnFunction
 * @type {(name: string, cb: (data: DataRecord, tag: string) => void) => void}
 */
/**
 * @typedef OnFunction
 * @type {(tag: string, name: string, cb: (data: DataRecord, tag: string) => void) => void}
 */
/**
 * @typedef ClearFunction
 * @type {(tag: string) => void}
 */
/**
 * @typedef CheckFunction
 * @type {(tag: string) => boolean}
 */

// /**@type {SocketHandler} */
// let x = (sock,globals,{change, emit, on}) => {
//     on;
//     emit;
// };

class HandlerInvocationError extends Error {
    /**
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "HandlerInvocationError";
    }
}

exports.SocketHandler = this.SocketHandler;
exports.TaggedEmitFunction = this.TaggedEmitFunction;
exports.TaggedOnFunction = this.TaggedOnFunction;
exports.EmitFunction = this.EmitFunction;
exports.OnFunction = this.OnFunction;
exports.ClearFunction = this.ClearFunction;
exports.CheckFunction = this.CheckFunction;
exports.DataRecord = this.DataRecord;
exports.GlobalRecord = this.GlobalRecord;
exports.GlobalState = this.GlobalState;
exports.HandlerState = this.HandlerState;
exports.PluginModule = this.PluginModule;
exports.HandlerInvocationError = HandlerInvocationError;
