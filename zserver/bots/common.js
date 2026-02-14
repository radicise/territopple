/**
 * @file
 * this file handles common functions for all Territopple bots
 */

const { extend, settings, __dname } = require("../../defs.js");
const fs = require("fs");
const path = require("path");
// console.log(__dname);
// const { Topology } = require("../../topology/topology.js");
/**
 * @typedef BotConfig
 * @type {{maxdepth:number,maxtime:number}}
 */
/**@type {Record<string,Record<string,BotConfig>>} */
const asettings = {};
if (fs.existsSync(path.join(__dirname, "botconf.json"))) {
    extend(asettings, JSON.parse(fs.readFileSync(path.join(__dirname, "botconf.json"))));
} else {
    console.log("MISSING BOT SETTINGS");
}
if (!asettings["default"]) {
    asettings["default"] = {maxdepth:1,maxtime:1000};
}

class TileLimitError extends Error {
    /**
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "TileLimitError";
    }
}

class Random {
    /**
     * @param {number} lo
     * @param {number} hi
     * @returns {number}
     */
    static randrange(lo, hi) {
        return Math.floor(Math.random()*(hi-lo) + lo);
    }
    /**
     * @template T
     * @param {T[]} arr
     * @returns {T}
     */
    static pick(arr) {
        const i = this.randrange(0, arr.length);
        // console.log(`I:${i},L:${arr.length},A:${arr}`);
        return arr[i];
    }
    /**
     * @param {[number,number]} moves [tile, score]
     * @returns {number}
     */
    static pickmove(moves) {
        const _ = moves.sort((a, b) => b[1]-a[1]);
        const ind = _.findIndex((v, i) => i>0?v[1]<_[i-1][1]:false);
        const sub = _.slice(0, ind<0?undefined:ind);
        const p = Random.pick(sub);
        // console.log(`${_}\n${ind}\n${sub}\n${p}`);
        return p[0];
    }
}

class DummyGame {
    constructor(parent, parentisgame, maxdepth) {
        if (parentisgame) {
            this.#fromGame(parent, maxdepth);
        } else {
            this.#fromDummy(parent);
        }
    }
    /**
     * @param {import("./bot_server.js").Game} game
     * @param {number} maxdepth
     */
    #fromGame(game, maxdepth) {
        const players = game.players;
        // property creation
        this._teamc = game.owned.length;
        this._playc = game.players.length;
        const tc = game.topology.tileCount;
        maxdepth = Math.min(Math.floor(TTBot.tile_limit/tc), maxdepth);
        this._maxdepth = maxdepth;
        this._tbstart = tc*maxdepth;
        this._boarddata = Buffer.allocUnsafe(this._tbstart*2);
        this._owneddata = Buffer.allocUnsafe(game.owned.length*maxdepth*4);
        this._topology = game.topology;
        this._playerdata = Buffer.allocUnsafe(players.length*maxdepth);
        this._turndata = Buffer.allocUnsafe(maxdepth);
        this.root = this;
        this.win = game.win ?? 0;
        this.depth = 0;
        // buffer initialization
        for (let i = 0; i < game.topology.tileCount; i ++) {
            this._boarddata[i] = game.board[i];
            this._boarddata[this._tbstart+i] = game.teamboard[i];
        }
        for (let i = 0; i < game.owned.length; i ++) {
            this._owneddata.writeUInt32BE(game.owned[i], i*4);
        }
        for (let i = 0; i < players.length; i ++) {
            this._playerdata[i] = (players[i].alive?0x80:0)|players[i].team;
        }
        this._turndata[0] = game.turn;
    }
    /**
     * @param {DummyGame} game
     */
    #fromDummy(game) {
        this.root = game.root;
        this.depth = game.depth+1;
        this.win = game.win ?? 0;
        for (let i = 0; i < this.topology.tileCount; i ++) {
            this.boarddata[this.#offsetB+i] = this.boarddata[game.#offsetB+i];
            this.boarddata[this.#offsetBT+i] = this.boarddata[game.#offsetBT+i];
        }
        for (let i = 0; i < this.playc; i ++) {
            this.playerdata[this.#offsetP+i] = this.playerdata[game.#offsetP+i];
        }
        for (let i = 0, l = this.teamc*4; i < l; i ++) {
            this.owneddata[this.#offsetO+i] = this.owneddata[game.#offsetO+i];
        }
        this.turn = game.turn;
    }
    /**
     * @returns {number}
     */
    getNextPlayer() {
        let i = this.turn;
        while (true) {
            i += 1;
            i = i % this.playc;
            if (i === this.turn) {
                this.win = this.playerdata[this.#offsetP+this.turn]&0x7f;
                return 255;
            }
            if (this.playerdata[this.#offsetP+i]&0x80) {
                return i;
            }
        }
    }
    /**
     * returns list of all valid moves
     * @returns {number[]}
     */
    getMoves() {
        const t = this.playerdata[this.#offsetP+this.turn]&0x7f;
        const l = [];
        this.boarddata.subarray(this.#offsetBT,this.#offsetBT+this.topology.tileCount).forEach((v, i) => {if(v === 0 || v === t)l.push(i);});
        return l;
    }
    /**
     * @param {number} tile
     * @returns {DummyGame}
     */
    move(tile) {
        if (this.depth+1 === this.maxdepth) {
            // const e = new Error("OOM");
            // e.OOM = true;
            // throw e;
            throw new TileLimitError("OOM");
        }
        // if (this.turn === 255) {
        //     console.log(new Error("2"));
        //     return this;
        // }
        const work = new DummyGame(this, false);
        const player = this.turn;
        const adds = [tile];
        const team = work.playerdata[work.#offsetP+player]&0x7f;
        // if (team > 2) {
        //     console.log("AGH");
        // }
        const tb = work.boarddata.subarray(work.#offsetBT, work.#offsetBT+this.topology.tileCount);
        const bb = work.boarddata.subarray(work.#offsetB, work.#offsetB+this.topology.tileCount);
        while (adds.length) {
            const t = adds.pop();
            // if (tb[t] > 2) {
            //     console.log("YIKES");
            // }
            if (tb[t] !== team) {
                const nov = work.getOwned(tb[t], true)-1;
                // if (nov < 0) {
                //     console.log("SCREWED");
                // }
                work.owneddata.writeUInt32BE(work.owneddata.readUint32BE(work.#offsetO+tb[t]*4)-1, work.#offsetO+tb[t]*4);
                work.owneddata.writeUInt32BE(work.owneddata.readUint32BE(work.#offsetO+team*4)+1, work.#offsetO+team*4);
                if (work.getOwned(0, true) === 0 && work.getOwned(tb[t], true) === 0) {
                    for (let i = work.#offsetP; i < this.playc; i ++) {
                        const tm = this.playerdata[work.#offsetP+i]&0x7f;
                        if (tm === tb[t]) {
                            this.playerdata[work.#offsetP+i] = tm;
                        }
                    }
                    // work.players.forEach((v, i) => {if(v&&v.team===tb[t]){v.alive=false;}});
                }
                tb[t] = team;
                if (work.getOwned(team, true) === bb.length) {
                    work.win = team;
                    work.turn = 255;
                    return work;
                }
            }
            bb[t] ++;
            const neighbors = work.topology.getNeighbors(t);
            if (bb[t] > neighbors.length) {
                bb[t] -= neighbors.length;
                adds.push(...neighbors);
            }
        }
        work.turn = work.getNextPlayer();
        return work;
    }
    /**
     * @param {number} pnum
     * @returns {number}
     */
    getTeam(pnum) {
        return this.playerdata[this.#offsetP+pnum]&0x7f;
    }
    /**
     * @param {number} pnum
     * @returns {number}
     */
    getOwned(pnum, _) {
        return this.owneddata.readUint32BE(this.#offsetO+(_?pnum:this.getTeam(pnum))*4);
    }
    get #offsetB() {return this.topology.tileCount*this.depth;}
    get #offsetBT() {return this.#offsetB+this.tbstart;}
    get #offsetO() {return this.teamc*this.depth*4;}
    get #offsetP() {return this.playc*this.depth;}
    get turn() {return this.turndata[this.depth];}
    set turn(v) {
        // if (v === 255) {
        //     console.log(new Error());
        // }
        this.turndata[this.depth]=v;
    }
    /**@returns {number} */
    get teamc(){return this.root._teamc;}
    /**@returns {number} */
    get playc(){return this.root._playc;}
    /**@returns {number} */
    get maxdepth(){return this.root._maxdepth;}
    /**@returns {number} */
    get tbstart(){return this.root._tbstart;}
    /**@returns {Buffer} */
    get boarddata(){return this.root._boarddata;}
    /**@returns {Buffer} */
    get owneddata(){return this.root._owneddata;}
    /**@returns {import("../../topology/topology.js").Topology} */
    get topology(){return this.root._topology;}
    /**@returns {Buffer} */
    get playerdata(){return this.root._playerdata;}
    /**@returns {Buffer} */
    get turndata(){return this.root._turndata;}
}

class DummyGameOld {
    // #total_tiles;
    /**
     * @param {import("../../defs").Game} game
     */
    constructor(game, _) {
        if (_) {
            // this.total_tiles = _game.total_tiles + _game.topology.tileCount;
            this.board = Array.from(game.board);
            this.teamboard = Array.from(game.teamboard);
            this.topology = game.topology;
            this.owned = Array.from(game.owned);
            this.players = game.players.map(v => v === null ? v : {alive:v.alive, team:v.team});
            this.turn = game.turn;
            this.win = game.win ?? 0;
            this.total_tiles = game.topology.tileCount + (game.total_tiles ?? 0);
            console.log(this.total_tiles);
            return;
        }
        this.total_tiles = game.state.topology.tileCount + (game.total_tiles ?? 0);
        this.board = Array.from(game.state.board);
        this.teamboard = Array.from(game.state.teamboard);
        /**@type {import("../../topology/topology.js").Topology} */
        this.topology = game.state.topology;
        this.owned = Array.from(game.state.owned);
        this.players = game.players.map(v => v === null ? v : {alive:v.alive, team:v.team});
        this.turn = game.state.turn;
        this.win = 0;
    }
    /**
     * returns list of all valid moves
     * @returns {number[]}
     */
    getMoves() {
        return this.teamboard.map((v, i) => (v === 0 || v === this.players[this.turn].team) ? i : null).filter(v => v !== null);
    }
    /**
     * @param {number} tile
     * @returns {DummyGame}
     */
    move(tile) {
        if (this.total_tiles + this.topology.tileCount >= TTBot.tile_limit) {
            // const e = new Error("OOM");
            // e.OOM = true;
            // throw e;
            throw new TileLimitError("OOM");
        }
        const work = new DummyGame(this, true);
        const player = this.turn;
        const adds = [tile];
        const p = work.players[player];
        const tb = work.teamboard;
        const bb = work.board;
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== p.team) {
                work.owned[tb[t]] --;
                if (work.owned[0] === 0 && work.owned[tb[t]] === 0) {
                    work.players.forEach((v, i) => {if(v&&v.team===tb[t]){v.alive=false;}});
                }
                work.owned[p.team] ++;
                tb[t] = p.team;
                if (work.owned[p.team] === bb.length) {
                    work.win = this.turn;
                    work.turn = -1;
                    return work;
                }
            }
            bb[t] ++;
            const neighbors = work.topology.getNeighbors(t);
            if (bb[t] > neighbors.length) {
                bb[t] -= neighbors.length;
                adds.push(...neighbors);
            }
        }
        work.turn = work.nextPlayer();
        return work;
    }
    /**
     * @returns {number}
     */
    nextPlayer() {
        let i = this.turn;
        while (true) {
            i += 1;
            i = i % this.players.length;
            if (i === this.turn) {
                this.win = this.players[this.turn].team;
                return -1;
            }
            if (this.players[i] !== null && this.players[i].alive) {
                this.turn = i;
                break;
            }
        }
        return this.turn;
    }
}

class TTBotInstance {
    #think;
    #parent;
    #pnum;
    /**
     * @param {TTBot} parent
     * @param {ThinkFunction} think
     * @param {number} pnum
     */
    constructor(parent, think, pnum) {
        this.#parent = parent;
        this.#think = think;
        this.#pnum = pnum;
    }
    async think(game, limit) {
        try {
            return await this.#think(this, new DummyGame(game, true, this.#parent.conf.maxdepth??1), limit);
        } catch (E) {
            // if (E.message !== "OOM") {
            // }
            console.log(E);
            return Random.pick(new DummyGame(game, true, 1).getMoves());
        }
    }
    /**
     * @readonly
     * @returns {number}
     */
    get pnum() {
        return this.#pnum;
    }
    /**
     * @readonly
     * @returns {TTBot}
     */
    get parent() {
        // return Object.getPrototypeOf(this).#parent;
        return this.#parent;
    }
    /**
     * @readonly
     * @returns {BotConfig}
     */
    get conf() {
        return this.#parent.conf;
    }
}

/**
 * @typedef ThinkFunction
 * @type {(that: TTBotInstance, gamestate: DummyGame, timelimit: number?) => Promise<number>}
 * @description
 * takes a board state and returns the tile index to place a piece on
 */

/**
 * @typedef DIFFICULTY
 * @type {0|1|2|3|4|5|6|7|8}
 */

const DIFF_LEVELS = {
    /**
     * @description
     * easiest possible difficulty level, completely new players should have no trouble
     * 
     * this level is meant for tutorial bots
     * @readonly
     * @returns {0}
     */
    get TRIVIAL() {return 0;},
    /**
     * @description
     * a bit harder than trivial, but still easy, a player with a basic grasp of mechanics will find this appropriate
     * 
     * this is meant for early stage bots
     * @readonly
     * @returns {1}
     */
    get BEGINNER() {return 1;},
    /**
     * @description
     * still basic, but a bit harder
     * 
     * this is meant for bots that incorporate basic tactics
     * @readonly
     * @returns {2}
     */
    get COMPETENT() {return 2;},
    /**
     * @description
     * less basic, but within reach of a player with a few wins under their belt
     * 
     * this is meant for bots that incorporate standard tactics
     * @readonly
     * @returns {3}
     */
    get MODERATE() {return 3;},
    /**
     * @description
     * starting to reach complex, winning is not within reach of a new player
     * 
     * this is meant for bots that incorporate standard tactics and basic strategy
     * @readonly
     * @returns {4}
     */
    get INTERMEDIATE() {return 4;},
    /**
     * @description
     * firmly in the realm of complex logic, winning will require effort by a skilled player
     * 
     * this is meant for bots that incorporate advanced tactics and standard strategy
     * @readonly
     * @returns {5}
     */
    get ADVANCED() {return 5;},
    /**
     * @description
     * raising the bar even further, this requires serious effort by a skilled player
     * 
     * this is meant for bots that incorporate advanced tactics and advanced strategy
     * @readonly
     * @returns {6}
     */
    get EXPERT() {return 6;},
    /**
     * @description
     * winning now will require deep understanding of the game
     * 
     * this is meant for bots that have advanced tactics and strategy with augmented look-ahead
     * @readonly
     * @returns {7}
     */
    get MASTER() {return 7;},
    /**
     * @description
     * these bots are not intended to be beaten
     * 
     * this is meant for bots that pull out all the stops
     * @readonly
     * @returns {8}
     */
    get TOPPLER() {return 8;},
    get 0(){return "Trivial"},
    get 1(){return "Beginner"},
    get 2(){return "Competent"},
    get 3(){return "Moderate"},
    get 4(){return "Intermediate"},
    get 5(){return "Advanced"},
    get 6(){return "Expert"},
    get 7(){return "Master"},
    get 8(){return "Toppler"}
};

Object.freeze(DIFF_LEVELS);

/**
 * @typedef BotInfo
 * @type {object}
 * @prop {string} disp display name
 * @prop {string} desc bot description / flavor text, supports \*italics* \*\*bold** \~strikethrough~ \_underline_ %mangled%
 * @prop {DIFFICULTY} diff bot difficulty rating
 * @prop {boolean} indexable if the bot shows up in the bot index
 * @prop {object} prereq prerequisites to challenge this bot
 * @prop {number[]} prereq.achi required achievements to get
 * @prop {string[]} prereq.bots required bots to beat
 */ 
 /* {desc: string, diff: number, prereq: {achi: number[], bots: string[]}}
 */

const PERF_MODES = {
};


class TTBot {
    #name;#short;#info;#cls;#conf;
    /**@readonly */
    static get tile_limit() {return settings.BOT_MAX_TILES;}
    /**@type {Record<string, TTBot>} */
    static #reg = {};
    /**@type {Record<string, string[]>} */
    static #shorts = {};
    /**@type {Record<string, string>} */
    static #index = null;
    /**
     * @param {string} name name of the bot, only used internally
     * @param {string} short_name name to bind the bot to for net requests
     * @param {BotInfo} info info about the bot
     * @param {ThinkFunction} think bot logic
     */
    constructor(name, short_name, info, think) {
        TTBot.#index = null;
        this.#name = name;
        this.#short = short_name;
        this.#conf = BotConf.getConfig(short_name, info.diff);
        const that = this;
        this.#cls = class extends TTBotInstance {
            constructor(pnum) {
                super(that, think, pnum);
            }
        };
        this.#info = info;
        TTBot.#reg[name] = this;
        if (!(short_name in TTBot.#shorts)) TTBot.#shorts[short_name] = [];
        TTBot.#shorts[short_name][info.diff] = name;
        Object.freeze(this.#info);
        Object.freeze(this);
    }
    /**
     * @readonly
     * @returns {string}
     */
    get name() {return this.#name;}
    /**
     * @readonly
     * @returns {string}
     */
    get short_name() {return this.#short;}
    /**
     * @readonly
     * @returns {BotInfo}
     */
    get info() {return this.#info;}
    /**
     * @readonly
     * @returns {BotConfig}
     */
    get conf() {return this.#conf}
    /**
     * @param {string} name
     * @param {number} playerNum
     * @returns {TTBotInstance}
     */
    static instance(name, playerNum) {
        return new this.#reg[name].#cls(playerNum);
    }
    /**
     * @param {string} name
     * @returns {TTBot}
     */
    static access(name) {
        return this.#reg[name];
    }
    /**
     * returns the full name of the bot with given short name and difficulty scale
     * @param {string} short_name
     * @param {number} diff
     * @returns {string}
     */
    static resolve(short_name, diff) {
        return this.#shorts[short_name][diff];
    }
    /**
     * @readonly
     * @returns {Record<string,string>}
     */
    static get index() {
        if (this.#index === null) {
            const ret = {};
            for (const skey in this.#shorts) {
                for (let i = 0; i < this.#shorts[skey].length; i ++) {
                    const name = this.#shorts[skey][i];
                    if (name === undefined) continue;
                    if (!this.#reg[name].#info.indexable) continue;
                    ret[`${this.#reg[name].#info.disp} (${DIFF_LEVELS[i]})`] = `${skey}/${i}`;
                }
            }
            this.#index = Object.freeze(ret);
        }
        return this.#index;
    }
}

class BotConf {
    /**
     * @param {string} botname
     * @param {number} level
     * @returns {BotConfig}
     */
    static getConfig(botname, level) {
        return (asettings[botname]??{})[DIFF_LEVELS[level]]??asettings["default"];
    }
}

function DBG(cmd) {
    if (!process.argv.includes("--eval-stdin")) process.exit(1);
    return eval(cmd);
}

exports.DBG = DBG;

exports.TTBot = TTBot;
exports.BotConf = BotConf;
exports.TTBotInstance = TTBotInstance;
exports.ThinkFunction = this.ThinkFunction;
exports.BotInfo = this.BotInfo;
exports.DIFFICULTY = this.DIFFICULTY;
exports.Random = Random;
exports.DummyGame = DummyGame;
exports.TileLimitError = TileLimitError;
exports.DIFF_LEVELS = DIFF_LEVELS;
