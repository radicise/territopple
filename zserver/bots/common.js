/**
 * @file
 * this file handles common functions for all Territopple bots
 */

const { extend } = require("../../defs.js");
const fs = require("fs");
// const { Topology } = require("../../topology/topology.js");
/**
 * @typedef BotConfig
 * @type {{maxdepth:number,maxtime:number}}
 */
/**@type {Record<string,Record<string,BotConfig>>} */
const asettings = {};
if (fs.existsSync("botconf.json")) {
    extend(asettings, JSON.parse(fs.readFileSync("botconf.json")));
}
if (!asettings["default"]) {
    asettings["default"] = {maxdepth:1,maxtime:1000};
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
        // console.log(`I:${i}`);
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
    /**
     * @param {import("../../defs").Game} game
     */
    constructor(game, _) {
        if (_) {
            this.board = Array.from(game.board);
            this.teamboard = Array.from(game.teamboard);
            this.topology = game.topology;
            this.owned = Array.from(game.owned);
            this.players = game.players.map(v => v === null ? v : {alive:v.alive, team:v.team});
            this.turn = game.turn;
            this.win = game.win ?? 0;
            return;
        }
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
    async think(game, _, limit) {
        return await this.#think(this, new DummyGame(game, _), limit);
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

exports.TTBot = TTBot;
exports.BotConf = BotConf;
exports.TTBotInstance = TTBotInstance;
exports.ThinkFunction = this.ThinkFunction;
exports.BotInfo = this.BotInfo;
exports.DIFFICULTY = this.DIFFICULTY;
exports.Random = Random;
exports.DummyGame = DummyGame;
exports.DIFF_LEVELS = DIFF_LEVELS;
