const codeChars = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "4", "5", "6", "7", "8", "9"];// THE LENGTH OF `codeChars' MUST BE A POWER OF TWO
const crypto = require("crypto");
/**
 * @typedef WS
 * @type {import("ws").WebSocket}
 */
/**
 * @typedef NetPayload
 * @type {{type:string,payload:Record<string,unknown>}}
 */
/*
 * @typedef Player
 * @type {{conn:import("ws").WebSocket,rejoin_key:Buffer,alive:boolean}|null}
 */
class Player {
    /**
     * @param {WS} conn
     */
    constructor(conn) {
        this.conn = conn;
        /**@type {boolean} */
        this.alive = true;
        /**@type {string} */
        this.rejoin_key = crypto.randomBytes(64).toString("base64url");
    }
    /**
     * regenerates the rejoin key, returns the new key for convenience
     * @returns {string}
     */
    reKey() {
        this.rejoin_key = crypto.randomBytes(64).toString("base64url");
        return this.rejoin_key;
    }
}
/**
 * @typedef Stats
 * @prop {number} connected total alive connections
 * @prop {number} spectating number of spectators (doesn't include players who have lost)
 * @prop {number} playing number of players (includes players who have lost)
 * @prop {number} maxPlayers max number of players for this game
 * @prop {number} reservedSlots number of slots reserved for players in the process of joining (for preventing race conditions)
 */
/**
 * @typedef State
 * @prop {number} rows
 * @prop {number} cols
 * @prop {number[]} board
 * @prop {number[]} teamboard
 * @prop {number[]} owned
 * @prop {number} move
 * @prop {number} turn
 * @prop {number} state
 * @prop {boolean} public
 * @prop {boolean} observable
 */
/*
 * @typedef Game
 * @type {{
 * stats: Stats,
 * state: State,
 * players:Player[],
 * ident:string,
 * buffer:Buffer[],
 * timestamp:number}}
 */

class Game {
    /**
     * @param {string} ident
     * @param {number} players
     * @param {{rows:number,cols:number,public:boolean,observable:boolean}} state
     */
    constructor (ident, players, state) {
        /**@type {string} */
        this.ident = ident;
        /**@type {Stats} */
        this.stats = {maxPlayers:players,playing:0,connected:0,spectating:0,reservedSlots:0};
        /**@type {State} */
        this.state = {
            rows: state.rows,
            cols: state.cols,
            board: new Array(state.rows*state.cols).fill(0),
            teamboard: new Array(state.rows*state.cols).fill(0),
            owned: new Array(players).fill(0),
            move: -1,
            turn: -1,
            state: 0,
            public: state.public,
            observable: state.observable
        };
        /**@type {Buffer[]} */
        this.buffer = [];
        /**@type {number} */
        this.timestamp = null;
        /**@type {(Player|null)[]} */
        this.players = [null];
        /**@type {Record<string,WS>} */
        this.spectators = {};
    }
    /**
     * kills all connections
     * @returns {void}
     */
    kill() {
        for (const k in this.spectators) {
            this.spectators[k].terminate();
        }
        for (const p of this.players) {
            if (p) {
                p.conn.terminate();
            }
        }
    }
    /**
     * validates move legality based on current turn
     * @param {number} tile
     * @param {number} player
     * @returns {boolean}
     */
    validateMove(tile, player) {
        if (this.state.turn !== player) {
            return false;
        }
        //
    }
    /**
     * @param {number} tile
     * @param {number} player
     */
    move(tile, player) {}
    /**
     * returns spectator id
     * @param {WS} conn
     * @returns {string}
     */
    addSpectator(conn) {
        let id;
        while (!id || id in this.spectators) {
            id = crypto.randomBytes(8).toString("base64url");
        }
        // this.sendAll(NetData.Spectator.Join(id));
        this.spectators[id] = conn;
        this.stats.spectating ++;
        this.stats.connected ++;
        return id;
    }
    /**
     * ensure that all data is finished being sent before calling this
     * @param {string} id spectator id
     */
    removeSpectator(id) {
        if (this.spectators[id]) {
            // this.spectators[id].terminate();
            delete this.spectators[id];
            this.stats.spectating --;
            this.stats.connected --;
        }
        // this.sendAll(NetData.Spectator.Leave(id));
    }
    /**
     * returns the player number
     * @param {WS} conn
     * @returns {number}
     */
    addPlayer(conn) {
        let pN = -1;
        const p = new Player(conn);
        for (let i = 0; i < this.players.length; i ++) {
            const cP = this.players[i];
            if (cP === null) {
                pN = i;
                this.players[i] = p;
                break;
            }
        }
        if (pN < 0) {
            pN = this.stats.playing;
            this.players.push(p);
        }
        this.stats.playing ++;
        this.stats.connected ++;
        // this.sendAll(NetData.Player.Join(pN), pN);
        p.conn.send(NetData.Key.Rejoin(p.rejoin_key));
        return pN;
    }
    /**
     * @param {number} playerNum
     * @returns {void}
     */
    removePlayer(playerNum) {
        // this.sendAll(NetData.Player.Leave(playerNum), playerNum);
        if (this.players[playerNum]) {
            this.stats.connected --;
            this.stats.playing --;
        }
        this.players[playerNum] = null;
    }
    /**
     * returns the player num that should be promoted
     * returns null if there are no players left
     * @returns {number | null}
     */
    getPromotion() {
        for (let i = 0; i < this.players.length; i ++) {
            if (this.players[i] !== null) {
                return i;
            }
        }
        return null;
    }
    /**
     * @param {string} message
     * @param {number|string|null} exclude player number/spectator id to exclude
     */
    sendAll(message, exclude) {
        let i = 0;
        for (const p of this.players) {
            if (p && i !== exclude) {
                p.conn.send(message);
            }
            i ++;
        }
        for (const s in this.spectators) {
            if (s !== exclude) {
                this.spectators[s].send(message);
            }
        }
    }
}

/**
 * @typedef HostingSettings
 * @type {{
 * GAMEPORT:number,
 * WEBPORT:number,
 * LISTPORT:number,
 * WEBCONTENT_DIR:string,
 * URL_MAP:Record<string,string>,
 * URL_MAP_GROUPS:Record<string,string[]>,
 * DEVOPTS:{expr_webpath:boolean},
 * REPLAYS:{ENABLED:boolean,TIMESTAMP:boolean,COLLATE:boolean}
 * }}
 */

const fs = require("fs");
const _path = require("path");
/**@type {HostingSettings} */
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
const extend = (e, o) => {
    for (const key in o) {
        if (typeof o[key] === 'object') {
            if (key in e) {
                extend(e[key], o[key]);
            } else {
                extend(e, o[key]);
            }
        } else {
            e[key] = o[key];
        }
    }
};
{
    const prefs = JSON.parse(fs.readFileSync(_path.join(__dirname, "prefs.json"), {encoding:"utf-8"}));
    extend(settings, prefs);
}

class NetData {
    /**
     * @param {string} type
     * @param {Record<string,any>?} data
     * @returns {string}
     */
    static Misc(type, data) {
        return JSON.stringify({type, payload:data??{}});
    }
    static Player = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`player:${type}`, data);
        }
        /**
         * @param {number} playerNumber
         * @returns {string}
         */
        static Join(playerNumber) {
            return Misc("join", {n:playerNumber});
        }
        /**
         * @param {number} playerNumber
         * @returns {string}
         */
        static Leave(playerNumber) {
            return Misc("leave", {n:playerNumber});
        }
        /**
         * @param {number} playerNumber
         * @param {string} spectatorId
         * @returns {string}
         */
        static Spectate(playerNumber, spectatorId) {
            return Misc("spectate", {n:playerNumber, id:spectatorId});
        }
    }
    static Spectator = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`spectator:${type}`, data);
        }
        /**
         * @param {string} spectatorId
         * @returns {string}
         */
        static Join(spectatorId) {
            return Misc("join", {n:spectatorId});
        }
        /**
         * @param {string} spectatorId
         * @returns {string}
         */
        static Leave(spectatorId) {
            return Misc("leave", {n:spectatorId});
        }
    }
    static Key = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`key:${type}`, data);
        }
        /**
         * @param {string} key
         * @returns {string}
         */
        static Rejoin(key) {
            return Misc("rejoin", {key});
        }
    }
    /**
     * @param {number} code
     * @param {string?} data
     * @returns {string}
     */
    static Error(code, data) {
        return Misc("error", {code, message:data??null});
    }
    static Waiting = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`waiting:${type}`, data);
        }
        /**
         * @param {number | string} n
         * @returns {string}
         */
        static Kick(n) {
            return Misc("kick", {n});
        }
        /**
         * @param {number} n
         * @returns {string}
         */
        static Promote(n) {
            return Misc("promote", {n});
        }
        /**
         * @returns {string}
         */
        static Start() {
            return Misc("start");
        }
    }
    static Game = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`game:${type}`, data);
        }
        /**
         * @param {number} tile
         * @param {number} team
         * @returns {string}
         */
        static Move(tile, team) {
            return Misc("move", {n:tile, t:team});
        }
        /**
         * @returns {string}
         */
        static Close() {
            return Misc("close");
        }
    }
}

/**
 * @type {Record<string,{l:(data: Record<string,unkown>)=>void,tag:string}[]>}
 */
const EventRegistry = {};

/**
 * @param {string} tag
 * @param {string} name
 * @param {Record<string,unkown>?} data
 */
function emit(tag, name, data) {
    if (name in EventRegistry) {
        EventRegistry[name].forEach(v => {
            v.l(data||{}, tag);
        });
    }
}
/**
 * @param {string} tag
 * @param {string} name
 * @param {(data: Record<string,unkown>, tag: string)=>void} cb
 */
function on(tag, name, cb) {
    if (name in EventRegistry) {
        EventRegistry[name].push({l:cb, tag});
    } else {
        EventRegistry[name] = [{l:cb, tag}];
    }
}
/**
 * @param {string} tag
 */
function clear(tag) {
    for (const name in EventRegistry) {
        const l = EventRegistry[name];
        EventRegistry[name] = l.filter(v => v.tag !== tag);
        // for (let i = l.length-1; i >= 0; i --) {
        //     if (l[i].tag === tag) {
        //     }
        // }
        if (EventRegistry[name].length === 0) {
            delete EventRegistry[name];
        }
    }
}

exports.extend = extend;
exports.emit = emit;
exports.on = on;
exports.clear = clear;
exports.HostingSettings = this.HostingSettings;
exports.Game = Game;
exports.NetData = NetData;
exports.Player = Player;
exports.Stats = this.Stats;
exports.State = this.State;
exports.NetPayload = this.NetPayload;
exports.codeChars = codeChars;
exports.settings = settings;
