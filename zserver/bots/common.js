/**
 * @file
 * this file handles common functions for all Territopple bots
 */

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
        return arr[this.randrange(0, arr.length)]
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
            this.win = game.win;
            return;
        }
        this.board = Array.from(game.state.board);
        this.teamboard = Array.from(game.state.teamboard);
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
    think(game) {
        return this.#think(this, new DummyGame(game));
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
}

/**
 * @typedef ThinkFunction
 * @type {(that: TTBotInstance, gamestate: DummyGame) => number}
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
    get TOPPLER() {return 8;}
};

Object.freeze(DIFF_LEVELS);

/**
 * @typedef BotInfo
 * @type {object}
 * @prop {string} disp display name
 * @prop {string} desc bot description / flavor text, supports \*italics* \*\*bold** \~strikethrough~ \_underline_ %mangled%
 * @prop {DIFFICULTY} diff bot difficulty rating
 * @prop {object} prereq prerequisites to challenge this bot
 * @prop {number[]} prereq.achi required achievements to get
 * @prop {string[]} prereq.bots required bots to beat
 */ 
 /* {desc: string, diff: number, prereq: {achi: number[], bots: string[]}}
 */

const PERF_MODES = {
};


class TTBot {
    #name;#info;#cls;
    /**@type {Record<string, TTBot>} */
    static #reg = {};
    /**
     * @param {string} name name of the bot, only used internally
     * @param {BotInfo} info info about the bot
     * @param {ThinkFunction} think bot logic
     */
    constructor(name, info, think) {
        this.#name = name;
        const that = this;
        this.#cls = class extends TTBotInstance {
            constructor(pnum) {
                super(that, think, pnum);
            }
        };
        this.#info = info;
        TTBot.#reg[name] = this;
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
     * @returns {BotInfo}
     */
    get info() {return this.#info;}
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
}

exports.TTBot = TTBot;
exports.ThinkFunction = this.ThinkFunction;
exports.BotInfo = this.BotInfo;
exports.DIFFICULTY = this.DIFFICULTY;
exports.Random = Random;
exports.DIFF_LEVELS = DIFF_LEVELS;
