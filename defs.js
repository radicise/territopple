const __dname = process.cwd();
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
        /**@type {boolean} */
        this.is_bot = false;
        /**@type {string} */
        this.accId = null;
        /**@type {string} */
        this.botq = null;
        /**@type {number} */
        this.res_time = null;
        /**@type {number} */
        this.set_time = null;
        /**@type {boolean} */
        this.needs_resume = false;
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
        this.timeout_cb = cb;
        this.set_time = Date.now();
        switch (game.rules.turnTime.style) {
            case "per turn":
                this.turn_timer = setTimeout(cb, this.res_time ?? game.rules.turnTime.limit);
                this.res_time = null;
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
 * @typedef Spectator
 * @type {{sock:WS,accId?:string}}
 */
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
        this.complexity = 1;
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
            owned: new Array(settings.MAX_TEAMS+1).fill(0),
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
        if (this.state.topology.tileCount > settings.MAX_TILES) {
            throw new PerfError("TOO MANY TILES");
        }
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
        // this._buffer = [];
        /**@type {number} */
        this.timestamp = null;
        /**@type {Player[]} */
        this.players = [null];
        /**@type {Record<string,Spectator>} */
        this.spectators = {};
        /**@type {BigInt} */
        this.sort_key = null;
        // this.__ended = false;
        this.__ended = 0;
        /**@type {number[]} */
        this.__extflags = [];
        /**@type {Record<number,Buffer>} */
        this.__extmeta = {};
        /**@type {Record<number,{condflag:boolean,flag_byte:number?,flag_bit:number?,size:number,producer:()=>Buffer}[]} */
        this.__extevds = {};
        this.stdmeta = {
            colors: null
        };
    }
    // get buffer() {
    //     // if (this.__ended) return [];
    //     if (this.state.state === 2) return [];
    //     // console.log(new Error("TRACER"));
    //     // console.log(this._buffer);
    //     return this._buffer;
    // }
    // set buffer(v) {
    //     // throw new Error("setting buffer?");
    //     this._buffer = v;
    // }
    /**
     * @param {string} key
     * @param {Buffer} value
     */
    setMeta(key, value) {
        const globi = key.indexOf("_");
        if (globi !== -1) {
            let c = 0;
            const s = key.slice(0, globi);
            // console.log(`globi: ${globi}, s: ${s}`);
            for (let i = 0, l = value.length; i < l; i += 0xffff) {
                const k = s+(c.toString(36).padStart(2,'0'));
                // console.log(`key: ${k}`);
                this.setMeta(k, value.subarray(i, Math.min(i+0xffff,l)));
            }
            return;
        }
        let k = key.charCodeAt(0)<<24;
        // console.log(k);
        k |= key.charCodeAt(1)<<16;
        // console.log(k);
        k |= key.charCodeAt(2)<<8;
        // console.log(k);
        k |= key.charCodeAt(3);
        // console.log(k);
        this.__extmeta[k] = value;
    }
    resumeTimers() {
        this.players.forEach(v => {
            if (!v) return;
            if (v.needs_resume) v.resetTimer(this, v.timeout_cb);
        });
    }
    pauseTimers() {
        const now = Date.now();
        this.players.forEach(v => {
            if (!v) return;
            if (v.turn_timer !== null) {
                v.needs_resume = true;
                switch (this.rules.turnTime.style) {
                    case "per turn":
                        v.res_time = now-v.set_time + 1500;
                        break;
                    case "chess":
                        v.time_left += 1;
                        break;
                }
            }
            v.resetTimer(this);
        });
    }
    stopTimers() {
        this.players.forEach(v => v?.resetTimer(this));
    }
    addExportMeta() {
        const pens = ["random", "skip", "lose"];
        const styles = ["per turn", "chess"];
        const rulz = Buffer.from([(this.rules.turnTime.limit?
            [1,
                pens.indexOf(this.rules.turnTime.penalty),
                styles.indexOf(this.rules.turnTime.style),
                this.rules.turnTime.style==="chess"?this.players.map(v=>nbytes(v?.time_left??0,4)):nbytes(this.rules.turnTime.limit/1000,4)
            ]
            :[0])].flat(5));
        this.setMeta("rlz_", rulz);
    }
    /**
     * @param {number|string} entid
     * @param {string} accid
     */
    updateAccountId(entid, accid) {
        if (typeof entid === "string") {
            if (entid in this.spectators) {
                this.spectators[entid].accId = accid;
            }
        } else {
            if (this.players[entid]) {
                this.players[entid].accId = accid;
            }
        }
    }
    /**
     * @param {string} key
     * @param {string} bot
     * @returns {string}
     */
    addBot(key, bot) {
        if (this.stats.playing === this.stats.maxPlayers) {
            return "";
        }
        const pN = this.findPlayerNum();
        this.players[pN] = new Player(null, ((pN-1)%settings.MAX_TEAMS)+1);
        this.players[pN].is_bot = true;
        this.players[pN].rejoin_key = key;
        this.players[pN].botq = bot;
        const that = this;
        this.players[pN].timeoutid = setTimeout(() => {
            if (that.state.state !== 0) {
                that.sendAll(NetData.Player.Leave(pN));
            }
            that.players[pN] = null;
        }, settings.BOT_TO);
        return `&n=${pN}`;
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
            this.spectators[k].sock.terminate();
        }
        for (const p of this.players) {
            if (p && p.conn) {
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
        const playerdata = Buffer.from([this.players.map(v=>!v?0:[Number(v.is_bot)+1,!v.is_bot?[]:[v.botq.length,v.botq.split("").map(w=>w.charCodeAt(0))],v.accId?[v.accId.length,v.accId.split("").map(w=>w.charCodeAt(0))]:0])].flat(5));
        this.setMeta("pn__", playerdata);
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
        // console.log("move recorded");
        onMove(this, tile, player);
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== p.team) {
                this.state.owned[tb[t]] --;
                if (this.state.owned[0] === 0 && this.state.owned[tb[t]] === 0) {
                    // console.log("team eliminated");
                    this.players.forEach((v, i) => {if(v&&v.team===tb[t]){onPlayerRemoved(this, i);v.alive=false;}});
                    if (tb[t] === 0) {
                        this.players.forEach((v, i) => {if(v&&v.alive&&this.state.owned[v.team]===0){onPlayerRemoved(this, i);v.alive=false;}});
                    }
                }
                this.state.owned[p.team] ++;
                tb[t] = p.team;
                if (this.state.owned[p.team] === bb.length) {
                    // console.log("win returned");
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
        this.spectators[id] = {sock:conn,accId:null};
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
     * @returns {number}
     */
    findPlayerNum() {
        let pN = -1;
        for (let i = 1; i < this.players.length; i ++) {
            const cP = this.players[i];
            if (cP === null) {
                pN = i;
                break;
            }
        }
        this.stats.playing ++;
        if (pN < 0) {
            pN = this.stats.playing;
        }
        return pN;
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
        p.team = ((pN-1)%settings.MAX_TEAMS)+1;
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
            if (this.players[i] !== null && !this.players[i].is_bot) {
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
            if (p && p.conn && i !== exclude) {
                p.conn.send(message);
            }
            i ++;
        }
        for (const s in this.spectators) {
            if (s !== exclude) {
                this.spectators[s].sock.send(message);
            }
        }
    }
}
exports.Game = Game;

/**
 * @typedef HostingSettings
 * @type {{
 * DEBUG?:{TRACE_WS?:boolean}
 * GAMEPORT:number,
 * DATAPORT:number,
 * WEBPORT:number,
 * INTERNALPORT:number,
 * BOTPORT:number,
 * AUTHPORT:number,
 * AUTHINTERNALPORT:number,
 * PUZZLEPORT:number,
 * ROOM_CODE_LENGTH:number,
 * PING_INTERVAL:number,
 * BOT_TO:number,
 * BOT_MAX_TILES:number,
 * DEVENV?:boolean,
 * ORIGIN:string,
 * WORKERS:{LIMIT:number,MAX_CONNECTIONS:number,MAX_TURNAROUND:number},
 * REJOIN_TIME:number,
 * APPEASEMENT:boolean,
 * WEBCONTENT_DIR:string,
 * URL_MAP:Record<string,string>,
 * URL_MAP_GROUPS:Record<string,string[]>,
 * DEVOPTS:{expr_webpath:boolean,pid_dir:string,log_dir:string},
 * REPLAYS:{ENABLED:boolean,TIMESTAMP:boolean,COLLATE:boolean},
 * MAX_TEAMS:number,
 * DB_CONFIG:{URI:string},
 * MAIL_CONFIG:{HOST:string,BOT_USER:string,BOT_PASS:string},
 * ACC:{CREATE_TO:number,SESSION_TO:number,PWRST_TO:number,NAME_MAX:number}
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
                // extend(e, o[key]);
                e[key] = o[key];
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
if (settings.DEVOPTS?.pid_dir?.startsWith("./")) {
    settings.DEVOPTS.pid_dir = _path.join(__dname, settings.DEVOPTS.pid_dir);
}

class NetData {
    /**
     * @param {string} type
     * @param {Record<string,any>?} data
     * @returns {string}
     */
    static Misc(type, data) {
        const pack = {type, payload:data??{}};
        if (settings.DEBUG?.TRACE_WS) {
            pack.trace = (new Error("TRACE").stack).split("\n").filter(v=>v.includes("territopple")).map(v=>v.trim()).join("@");
        }
        return JSON.stringify(pack);
    }
    static CONN = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`CONN:${type}`, data);
        }
        /**
         * @returns {string}
         */
        static HOLD() {
            return this.Misc("HOLD");
        }
        /**
         * @returns {string}
         */
        static CONT() {
            return this.Misc("CONT");
        }
        /**
         * @param {string} P
         * @param {string[]} D
         * @returns {string}
         */
        static SWCH(P, D) {
            return this.Misc("SWCH", {P, D});
        }
        /**
         * @returns {string}
         */
        static DYNG() {
            return this.Misc("DYNG");
        }
    }
    static Account = class {
        /**
         * @param {string} type
         * @param {Record<string,any>?} data
         * @returns {string}
         */
        static Misc(type, data) {
            return NetData.Misc(`account:${type}`, data);
        }
        /**
         * @param {number|string} id
         * @param {string} acc
         * @returns {string}
         */
        static Found(id, acc) {
            return this.Misc("found", {n:id, a:acc});
        }
        /**
         * @param {number} id
         * @param {string} name
         * @returns {string}
         */
        static IsBot(id, name) {
            return this.Misc("isbot", {n:id, a:name});
        }
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
        /**
         * @param {number[]} colors
         * @returns {string}
         */
        static TeamCols(colors) {
            return this.Misc("teamcols", {c:colors});
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
         * @param {number | string} n
         * @returns {string}
         */
        static Kick(n) {
            return this.Misc("kick", {n});
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
            const o = {c:game.state.topology.tileCount,d:topology.m.exportDimensions(game.state.topology),t:topology.m.getTopologyId(game.state.topology),p:game.stats.maxPlayers,l:game.state.hostNum,tc:game.stdmeta.colors};
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
            const players = game.players.map((v, i) => v ? [i, v.team, v.accId] : null).filter(v => v !== null);
            const spectators = Object.keys(game.spectators).map(v => [v, game.spectators[v].accId]);
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
        /**
         * @param {number} time_left
         * @returns {string}
         */
        static Pause(time_left) {
            return this.Misc("pause", {t:time_left??0});
        }
        /**
         * @returns {string}
         */
        static Resume() {
            return this.Misc("resume", {});
        }
    }
    /**
     * @param {string?} kind
     * @returns {string}
     */
    static Ping(kind) {
        return NetData.Misc("ping", {kind:kind??"default"});
    }
    static Bin = class {
        /**
         * @param {Game} game
         * @returns {Buffer}
         */
        static Export(game) {
            return Buffer.concat([Buffer.of(2), Buffer.concat(game.buffer.slice(0, game.__ended))]);
        }
        /**
         * @param {Game} game
         * @returns {Buffer}
         */
        static Replay(game) {
            return Buffer.concat([Buffer.of(1), Buffer.concat(game.buffer.slice(0, game.__ended))]);
        }
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
 * @param {(data: {[key: string]: unknown, "#gameid":string}, tag: string)=>void} cb
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
class PerfError extends Error {
    /**
     * @param {string} message
     */
    constructor (message) {
        super(message);
        this.name = "PerfError";
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

/**
 * @typedef JSONSchemeType
 * @type {"number"|"boolean"|"string"|"any"}
 */
/**
 * @typedef JSONScheme
 * @type {{
 * [key: string]: JSONScheme|JSONSchemeType|[JSONScheme|JSONSchemeType],
 * "*"?:"any"
 * }}
 */

/**
 * validates the given JSON string against the provided scheme
 * @param {object} obj
 * @param {JSONScheme} scheme
 * @returns {boolean}
 */
function validateJSONScheme(obj, scheme) {
    try {
        const allow_extensions = scheme["*"] === "any";
        if (Object.keys(scheme).filter(v => !v.endsWith("?")).some(v => !(v in obj))) {
            return false;
        }
        for (const _key in obj) {
            let key = _key;
            if ((key+"?") in scheme) {
                key = key + "?";
            }
            // console.log(key);
            if (key in scheme) {
                if (typeof scheme[key] === "string") {
                    if (typeof obj[_key] !== scheme[key] && scheme[key] !== "any") {
                        return false;
                    }
                } else if (Array.isArray(scheme[key])) {
                    if (!Array.isArray(obj[_key])) {
                        return false;
                    }
                    if (!obj[_key].every(v => (typeof scheme[key][0] === "object") ? validateJSONScheme(obj, scheme[key][0]) : (scheme[key][0] === "any" || typeof v === scheme[key][0]))) {
                        return false;
                    }
                }
            } else if (!allow_extensions) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} fpath
 */
function ensureFile(fpath) {
    const parts = fpath.split(_path.sep);
    console.log(fpath);
    console.log(parts);
    const _dname = _path.isAbsolute(fpath) ? "/" : __dname;
    console.log(_dname);
    parts.slice(0, parts.length-1).forEach((v, i, a) => {
        const seg = _path.join(...a.slice(0, i+1));
        console.log(seg);
        console.log(`${v} :: ${i} :: ${a}`);
        if (!fs.existsSync(_path.join(_dname, seg))) {
            fs.mkdirSync(_path.join(_dname, seg));
        }
    });
    if (!fs.existsSync(_path.join(_dname, fpath))) {
        fs.writeFileSync(_path.join(_dname, fpath), "");
    }
}

/**
 * @param {string} lpath
 * @param {string} data
 */
function addLog(lpath, data) {
    fs.appendFileSync(_path.join(__dname, lpath), data, {encoding:"utf-8"});
}

/**
 * @param {string} lpath
 */
function logStamp(lpath) {
    addLog(lpath, `\n\n${new Date()} - STARTUP\n\n`);
}

/**
 * @param  {boolean} bit7
 * @param  {boolean} bit6
 * @param  {boolean} bit5
 * @param  {boolean} bit4
 * @param  {boolean} bit3
 * @param  {boolean} bit2
 * @param  {boolean} bit1
 * @param  {boolean} bit0
 * @returns {number}
 */
function assembleByte(bit7,bit6,bit5,bit4,bit3,bit2,bit1,bit0) {
    return [bit7,bit6,bit5,bit4,bit3,bit2,bit1,bit0].reduce((pv, cv, ci) => pv | ((cv?1:0)<<(7-ci)),0);
}

exports.__dname = __dname;
exports.extend = extend;
exports.assembleByte = assembleByte;
exports.ensureFile = ensureFile;
exports.addLog = addLog;
exports.logStamp = logStamp;
exports.emit = emit;
exports.on = on;
exports.clear = clear;
exports.nbytes = nbytes;
exports.validateJSONScheme = validateJSONScheme;
exports.JSONScheme = this.JSONScheme;
// exports.JSONSchemeType = this.JSONSchemeType;
// exports.HostingSettings = this.HostingSettings;
exports.NetData = NetData;
exports.Player = Player;
// exports.Stats = this.Stats;
// exports.State = this.State;
// exports.NetPayload = this.NetPayload;
exports.SecurityError = SecurityError;
exports.InvariantViolationError = InvariantViolationError;
exports.TypeConversionError = TypeConversionError;
exports.ValueError = ValueError;
exports.PerfError = PerfError;
exports.Random = Random;
exports.codeChars = codeChars;
exports.settings = settings;
