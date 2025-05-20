const codeChars = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "4", "5", "6", "7", "8", "9"];// THE LENGTH OF `codeChars' MUST BE A POWER OF TWO
const crypto = require("crypto");
const os = require("os");
const fingerprint = crypto.hash("md5", os.hostname()+os.homedir()+os.machine(), "buffer");
exports.fingerprint = fingerprint;
const topology = new class{
    #m=null;
    set m(v){if(this.#m===null){this.#m=v;}}
    /**@returns {typeof import("./topology/topology.js")} */
    get m(){return this.#m;}
}();
exports.loadPromise = new Promise((res,_) => {
    import("./topology/topology.js").then(v => {
        topology.m = v;
        res(v);
    }, r => {throw new ReferenceError("could not load topology module");});
});
exports.topology = topology;
const fs = require("fs");
const _path = require("path");

function TraceLog(v) {
    fs.appendFileSync("tracelog.txt", `TRACELOG ${new Date()}\n${v}\n${new Error().stack}\n\n`);
}

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
     * @param {number} team
     */
    constructor(conn, team) {
        this.conn = conn;
        this.team = team;
        /**@type {boolean} */
        this.alive = true;
        /**@type {string} */
        this.rejoin_key = crypto.randomBytes(64).toString("base64url");
        /**@type {boolean} */
        this.ready = false;
        /**@type {number} */
        this.dcon_timer = null;
        /**@type {number} */
        this.turn_timer = null;
        /**@type {number} */
        this.time_left = 0;
    }
    /**
     * @param {Game} game
     * @param {Function} cb
     */
    resetTimer(game, cb) {
        if (this.turn_timer) {
            switch (game.rules.turnTime.style) {
                case "per turn":
                    clearTimeout(this.turn_timer);
                    break;
                case "chess":
                    clearInterval(this.turn_timer);
                    break;
            }
            this.turn_timer = null;
        }
        if (!cb) return;
        if (!game.rules.turnTime.limit) return;
        switch (game.rules.turnTime.style) {
            case "per turn":
                this.turn_timer = setTimeout(cb, game.rules.turnTime.limit);
                break;
            case "chess":
                this.turn_timer = setInterval(() => {
                    if (this.time_left === 0) return;
                    this.time_left --;
                    if (this.time_left === 0) {
                        // console.log("TIMEUP");
                        clearInterval(this.turn_timer);
                        this.turn_timer = null;
                        cb();
                    }
                }, 1000);
                break;
        }
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
 * @typedef TurnTimerSettings
 * @prop {"per turn"|"chess"} style style of turn timer
 * @prop {number|null} limit null defines unlimited time
 * @prop {"random"|"skip"|"lose"} penalty random move or skip turn
 */
/**
 * @typedef GameRules
 * @prop {TurnTimerSettings} turnTime
 */
/**
 * @typedef Stats
 * @prop {number} connected total alive connections
 * @prop {number} spectating number of spectators (doesn't include players who have lost)
 * @prop {number} playing number of players (includes players who have lost)
 * @prop {number} maxPlayers max number of players for this game
 * @prop {number} reservedSlots number of slots reserved for players in the process of joining (for preventing race conditions)
 * @prop {number} readies
 */
/**
 * @typedef State
 * @prop {number} rows
 * @prop {number} cols
 * @prop {import("./topology/topology.js").Topology} topology
 * @prop {number[]} board
 * @prop {number[]} teamboard
 * @prop {number[]} owned
 * @prop {number} move
 * @prop {number} turn
 * @prop {number} state
 * @prop {boolean} public
 * @prop {boolean} observable
 * @prop {number} hostNum
 * @prop {boolean} firstTurn
 */

class Game {
    /**
     * @param {string} ident
     * @param {number} players
     * @param {{topology:import("./topology/topology.js").TopologyParams,public:boolean,observable:boolean}} state
     */
    constructor (ident, players, state) {
        /**@type {string} */
        this.ident = ident;
        /**@type {Stats} */
        this.stats = {maxPlayers:players,playing:0,connected:0,spectating:0,reservedSlots:0};
        /**@type {State} */
        this.state = {
            // rows: state.rows,
            // cols: state.cols,
            get rows() {console.log(`${new Error("fix rows access").stack}`);return 5;},
            get cols() {console.log(`${new Error("fix cols access").stack}`);return 5;},
            topology: topology.m.makeTopology(state.topology),
            board: null,
            teamboard: null,
            owned: new Array(6).fill(0),
            move: -1,
            turn: -1,
            // _turn: -1,
            // get turn(){return this._turn;},
            // set turn(v){TraceLog(v);this._turn = v;},
            state: 0,
            public: state.public,
            observable: state.observable,
            hostNum: 0,
            firstTurn: true
        };
        this.state.board = new Array(this.state.topology.tileCount).fill(1);
        this.state.teamboard = new Array(this.state.topology.tileCount).fill(0);
        this.state.owned[0] = this.state.topology.tileCount;
        /**@type {GameRules} */
        this.rules = {
            turnTime: {
                style: "per turn",
                limit: null,
                penalty: "random"
            }
        };
        extend(this.rules, state.rules||{});
        /**@type {Buffer[]} */
        this.buffer = [];
        /**@type {number} */
        this.timestamp = null;
        /**@type {Player[]} */
        this.players = [null];
        /**@type {Record<string,WS>} */
        this.spectators = {};
        /**@type {BigInt} */
        this.sort_key = null;
    }
    /**
     * @param {GameRules} rules
     */
    addRules(rules) {
        extend(this.rules, rules);
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
        if (this.state.turn !== player) { // current turn
            return false;
        }
        const p = this.players[player];
        if (this.state.teamboard[tile] !== p.team && this.state.teamboard[tile] !== 0) { // team matches
            return false;
        }
        return true;
    }
    start() {
        this.state.state = 1;
        if (this.rules.turnTime.style === "chess") {
            for (let i = 0; i < this.players.length; i ++) {
                if (this.players[i]) this.players[i].time_left = this.rules.turnTime.limit/1000;
            }
        }
        for (let i = 0; i < this.players.length; i ++) {
            if (this.players[i] !== null) {
                this.state.turn = i;
                break;
            }
        }
    }
    /**
     * @param {number} tile
     * @param {number} player
     * @returns {{win:boolean,turn:number}}
     */
    move(tile, player) {
        this.firstTurn = false;
        const adds = [tile];
        const p = this.players[player];
        const tb = this.state.teamboard;
        const bb = this.state.board;
        // const w = this.state.cols;
        // const h = this.state.rows;
        // const tcol = tile % w;
        // const trow = (tile-tcol)/w;
        // onMove(this, trow, tcol, player);
        onMove(this, tile, player);
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== p.team) {
                this.state.owned[tb[t]] --;
                if (this.state.owned[0] === 0 && this.state.owned[tb[t]] === 0) {
                    this.players.forEach((v, i) => {if(v&&v.team===tb[t]){onPlayerRemoved(this, i);v.alive=false;}});
                }
                this.state.owned[p.team] ++;
                tb[t] = p.team;
                if (this.state.owned[p.team] === bb.length) {
                    return {win:true,turn:-1};
                }
            }
            bb[t] ++;
            // const c = t%w;
            // const r = (t-c)/w;
            // let mv = 4 - ((c===0||c===w-1)?1:0) - ((r===0||r===h-1)?1:0);
            // if (bb[t] > mv) {
            //     bb[t] = 1;
            //     if (c > 0) {
            //         adds.push(t-1);
            //     }
            //     if (c < w-1) {
            //         adds.push(t+1);
            //     }
            //     if (r > 0) {
            //         adds.push(t-w);
            //     }
            //     if (r < h-1) {
            //         adds.push(t+w);
            //     }
            // }
            const neighbors = this.state.topology.getNeighbors(t);
            if (bb[t] > neighbors.length) {
                bb[t] -= neighbors.length;
                adds.push(...neighbors);
            }
        }
        return this.nextPlayer();
    }
    nextPlayer() {
        let i = this.state.turn;
        // console.log(`STATE: ${this.state}`);
        // console.log(`TURN: ${this.state.turn}`);
        // console.log(this.players);
        while (true) {
            i += 1;
            i = i % this.players.length;
            if (i === this.state.turn) {
                return {win:true,turn:-1};
            }
            // if (this.players[i] !== null && (this.state.owned[0]||this.state.owned[this.players[i].team])) {
            // console.log(`I: ${i}`);
            // console.log(this.players[i]);
            if (this.players[i] !== null && this.players[i].alive) {
                this.state.turn = i;
                break;
            }
        }
        return {win:false,turn:this.state.turn};
    }
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
        const p = new Player(conn, 0);
        for (let i = 1; i < this.players.length; i ++) {
            const cP = this.players[i];
            if (cP === null) {
                pN = i;
                this.players[i] = p;
                break;
            }
        }
        this.stats.playing ++;
        if (pN < 0) {
            pN = this.stats.playing;
            this.players.push(p);
        }
        p.team = pN;
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
            if (this.players[playerNum].ready) {
                this.stats.readies --;
            }
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
 * REJOIN_TIME:number,
 * APPEASEMENT:boolean,
 * WEBCONTENT_DIR:string,
 * URL_MAP:Record<string,string>,
 * URL_MAP_GROUPS:Record<string,string[]>,
 * DEVOPTS:{expr_webpath:boolean},
 * REPLAYS:{ENABLED:boolean,TIMESTAMP:boolean,COLLATE:boolean}
 * }}
 */

// const { onPlayerRemoved, onMove } = require("./replayHooks");
const replayHooks = require("./replayHooks.js");
const onPlayerRemoved = replayHooks.onPlayerRemoved;
const onMove = replayHooks.onMove;
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
         * @param {number} team
         * @returns {string}
         */
        static Join(playerNumber, team) {
            return this.Misc("join", {n:playerNumber, t:team});
        }
        /**
         * @param {number} playerNumber
         * @param {number} team
         * @returns {string}
         */
        static Switch(playerNumber, team) {
            return this.Misc("switch", {n:playerNumber, t:team});
        }
        /**
         * @param {number} playerNumber
         * @returns {string}
         */
        static Leave(playerNumber) {
            return this.Misc("leave", {n:playerNumber});
        }
        /**
         * @param {number} playerNumber
         * @param {string} spectatorId
         * @returns {string}
         */
        static Spectate(playerNumber, spectatorId) {
            return this.Misc("spectate", {n:playerNumber, id:spectatorId});
        }
        /**
         * @param {number} playerNumber
         * @param {number} team
         * @returns {string}
         */
        static Ownid(playerNumber, team) {
            return this.Misc("ownid", {n:playerNumber, t:team});
        }
        /**
         * @param {number} playerNum
         * @returns {string}
         */
        static Lose(playerNum) {
            return this.Misc("lose", {n:playerNum});
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
            return this.Misc("join", {n:spectatorId});
        }
        /**
         * @param {string} spectatorId
         * @returns {string}
         */
        static Leave(spectatorId) {
            return this.Misc("leave", {n:spectatorId});
        }
        /**
         * @param {string} spectatorId
         * @returns {string}
         */
        static Ownid(spectatorId) {
            return this.Misc("ownid", {n:spectatorId});
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
         * @param {string} gameid
         * @param {number} playerNum
         * @returns {string}
         */
        static Rejoin(key, gameid, playerNum) {
            return this.Misc("rejoin", {key, g:gameid, p:playerNum});
        }
    }
    /**
     * @param {number} code
     * @param {string?} data
     * @param {{redirect?:string,store?:string}|string} rs
     * @returns {string}
     */
    static Error(code, data, rs) {
        const {redirect, store} = typeof rs==="object"?rs:(typeof rs==="string"?{redirect:rs}:{});
        return this.Misc("error", {code, message:data??null, redirect:redirect??null, store:store??null});
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
            return this.Misc("kick", {n});
        }
        /**
         * @param {number} n
         * @returns {string}
         */
        static Promote(n) {
            return this.Misc("promote", {n});
        }
        /**
         * @returns {string}
         */
        static Start() {
            return this.Misc("start");
        }
        /**
         * @param {number} playerNum
         * @param {boolean} ready
         * @returns {string}
         */
        static SetReady(playerNum, ready) {
            return this.Misc("setready", {n:playerNum,r:ready});
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
            return this.Misc("move", {n:tile, t:team});
        }
        /**
         * @param {number} playerNum
         * @param {boolean?} doTimer
         * @returns {string}
         */
        static Turn(playerNum, doTimer) {
            return this.Misc("turn", {n:playerNum,t:doTimer??true});
        }
        /**
         * @returns {string}
         */
        static Close() {
            return this.Misc("close");
        }
        /**
         * @param {number} team
         * @returns {string}
         */
        static Win(team) {
            return this.Misc("win", {t:team});
        }
        /**
         * @param {string} id
         * @returns {string}
         */
        static Roomid(id) {
            return this.Misc("roomid", {g:id});
        }
        /**
         * @param {Game} game
         * @returns {string}
         */
        static Config(game) {
            const o = {c:game.state.topology.tileCount,d:topology.m.exportDimensions(game.state.topology),t:topology.m.getTopologyId(game.state.topology),p:game.stats.maxPlayers,l:game.state.hostNum};
            // let d;
            // switch (o.t) {
            //     case 0:{
            //         d = {width:game.state.topology.width};
            //         break;
            //     }
            // }
            // o.d = d;
            return this.Misc("config", o);
        }
        /**
         * @param {Game} game
         * @returns {string}
         */
        static JList(game) {
            const players = game.players.map((v, i) => v ? [i, v.team] : null).filter(v => v !== null);
            const spectators = Object.keys(game.spectators)
            return this.Misc("jlist", {p:players,s:spectators});
        }
        /**
         * @returns {string}
         */
        static Reconnected() {
            return this.Misc("reconnected");
        }
        /**
         * @param {Game} game
         * @returns {string}
         */
        static Rules(game) {
            return this.Misc("rules", game.rules);
        }
        /**
         * @param {number} playerNum
         * @returns {string}
         */
        static Timeup(playerNum) {
            return this.Misc("timeup", {n:playerNum});
        }
    }
    static Bin = class {
        /**
         * @param {Game} game
         * @returns {Buffer}
         */
        static Board(game) {
            /**@type {bigint[]} */
            let d = [];
            /**@type {number[]} */
            let dnew = [];
            let bposnew = 8;
            const pushbitsnew = (bits, n) => {
                if (bpos === 8) {
                    bpos = 0;
                    d.push(0);
                }
                if (bpos + n > 8) {
                    const n1 = 8 - bpos;
                    const n2 = n - n1;
                    pushbits(bits>>n2, n1);
                    pushbits(bits, n2);
                    return;
                }
                const p = d.length - 1;
                // console.log(bits, n);
                d[p] = d[p] | (((bits&(0xff>>(8-n)))<<(8-bpos))&0xff);
                bpos += n;
            }
            let bpos = 64n;
            const pushbits = (bits, n) => {
                bits = BigInt(bits);
                n = BigInt(n);
                if (bpos === 64n) {
                    bpos = 0n;
                    d.push(0n);
                }
                if (bpos + n > 64n) {
                    const n1 = 64n - bpos;
                    const n2 = n - n1;
                    pushbits(bits>>n2, n1);
                    pushbits(bits, n2);
                    return;
                }
                // console.log(`${bits}, ${n}`);
                const p = d.length-1;
                for (let i = n-1n; i >= 0n; i --) {
                    d[p] = d[p] | (((bits>>i)&1n)<<(63n-bpos));
                    // d[p] = d[p] | (((n>>i)&1n)<<(bpos));
                    bpos ++;
                }
            };
            const bb = game.state.board;
            const tb = game.state.teamboard;
            // let i = 0;
            // for (let row = 0; row < game.state.rows; row ++) {
            //     for (let col = 0; col < game.state.cols; col ++) {
            //         if ((row === 0 || row === mrow))
            //         i ++;
            //     }
            // }
            // const bleft = game.state.rows * (game.state.cols - 1) - 1;
            // const bright = bb.length - 1;
            for (let i = 0; i < bb.length; i ++) {
                pushbits(bb[i] - 1, game.state.topology.getRequiredBits(i));
                // pushbits(bb[i] - 1, 2);
                // console.log(d.map(v => v.toString(2)));
            }
            // console.log(Buffer.from(d).toString("hex"));
            let count = 1;
            let curr = tb[0];
            for (let i = 1; i < tb.length; i ++) {
                if (tb[i] === curr) {
                    count ++;
                    if (count === 17) {
                        pushbits(1, 1);
                        pushbits(curr, 3);
                        pushbits(15, 4);
                        count = 1;
                    }
                    continue;
                }
                if (count > 1) {
                    pushbits(1, 1);
                    pushbits(curr, 3);
                    pushbits(count-1, 4);
                } else {
                    pushbits(0, 1);
                    pushbits(curr, 3);
                }
                count = 1;
                curr = tb[i];
            }
            if (count > 1) {
                pushbits(1, 1);
                pushbits(curr, 3);
                pushbits(count-1, 4);
            } else {
                pushbits(0, 1);
                pushbits(curr, 3);
            }
            // console.log(d.map(v => v.toString(2).padStart(64, '0')));
            // Buffer.of().toString("")
            // return Buffer.concat([Buffer.of(0), Buffer.from(d)]);
            let buff = Buffer.alloc(d.length*8);
            for (let i = 0; i < d.length; i ++) {
                buff.writeBigUInt64BE(d[i], i*8);
            }
            return Buffer.concat([Buffer.of(0), buff]);
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

class Random {
    /**
     * @param {number} lo
     * @param {number} hi
     * @param {number?} step
     * @returns {number}
     */
    static range(lo, hi, step) {
        return (Math.floor(Math.random()*((hi-lo)/(step||1)))*(step||1))+lo;
    }
    /**
     * @template T
     * @param {T[]} list
     * @returns {T}
     */
    static choice(list) {
        return list[this.range(0, list.length)];
    }
}

class SecurityError extends Error {
    constructor(message) {
        super(message);
        this.name = "SecurityError";
    }
}
class InvariantViolationError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvariantViolationError";
    }
}
class TypeConversionError extends Error {
    /**
     * represents an error caused by an attempt to convert between incompatible types
     * @param {String} message
     */
    constructor (message) {
        super(message);
        this.name = "TypeConversionError";
    }
}
class ValueError extends Error {
    /**
     * represents an error caused by an invalid value
     * @param {String} message
     */
    constructor (message) {
        super(message);
        this.name = "ValueError";
    }
}

/**
 * @param {number|BigInt} n
 * @param {number} c
 * @returns {number[]}
 */
function nbytes(n, c) {
    n = BigInt(n);
    // console.log(n, c);
	return [n&0xffn,(n>>8n)&0xffn,(n>>16n)&0xffn,(n>>24n)&0xffn,(n>>32n)&0xffn,(n>>40n)&0xffn,(n>>48n)&0xffn,(n>>56n)&0xffn].map(v => Number(v)).slice(0, c).reverse();
}

exports.extend = extend;
exports.emit = emit;
exports.on = on;
exports.clear = clear;
exports.nbytes = nbytes;
exports.HostingSettings = this.HostingSettings;
exports.Game = Game;
exports.NetData = NetData;
exports.Player = Player;
exports.Stats = this.Stats;
exports.State = this.State;
exports.NetPayload = this.NetPayload;
exports.SecurityError = SecurityError;
exports.InvariantViolationError = InvariantViolationError;
exports.TypeConversionError = TypeConversionError;
exports.ValueError = ValueError;
exports.Random = Random;
exports.codeChars = codeChars;
exports.settings = settings;
