/**
 * @file
 * various Territopple AIs
 */

const { updateboard } = require("./serverhelpers.js");

/**
 * @typedef TerriAI
 * @type {(game:import("./server").Game)=>number}
 * @description
 * takes a game and returns the number corresponding to the tile chosen
 */

/**
 * @param {import("./server").Game} game
 * @returns {import("./server").Game}
 */
function gameCopy(game) {
    return {teamboard:Array.from(game.teamboard),board:Array.from(game.board),rows:game.rows,cols:game.cols,turn:game.turn,owned:Array.from(game.owned)};
}

/**
 * @param {import("./server").Game} game
 * @returns {number[]}
 */
function getValidMoves(game) {
    /**@type {number[]} */
    const moves = [];
    for (let i = 0; i < (game.rows*game.cols); i ++) {
        if ((game.teamboard[i] || game.turn) == game.turn) {
            moves.push(i);
        }
    }
    return moves;
}
/**
 * @param {import("./server").Game} game
 * @param {number} i
 * @returns {number}
 */
function getTileMax(game, i) {
    const c = i % game.cols;
    const r = (i - c) / game.cols;
    return (r > 0 && c > 0 && c < (game.cols-1) && r < (game.rows-1)) ?  4 : (((r > 0 && r < (game.rows-1)) || (c > 0 && c < (game.cols-1))) ? 3 : 2);
}
/**
 * @param {import("./server").Game} game
 * @param {number} i
 * @returns {boolean}
 */
function isVolatile(game, i) {
    const c = i % game.cols;
    const r = (i - c) / game.cols;
    return (r > 0 && c > 0 && c < (game.cols-1) && r < (game.rows-1)) ? (game.board[i] === 4) : (((r > 0 && r < (game.rows-1)) || (c > 0 && c < (game.cols-1))) ? (game.board[i] === 3) : game.board[i] === 2);
}
/**
 * @param {import("./server").Game} game
 * @returns {number[]}
 */
function getVolatiles(game) {
    return getValidMoves(game).filter((v) => isVolatile(game, v));
}
/**
 * @param {import("./server").Game} game
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function compareCloseVolatile(game, a, b) {
    return (getTileMax(game, a) - game.board[a]) - (getTileMax(game, b) - game.board[b]);
}
/**
 * @param {import("./server").Game} game
 * @param {number} i
 * @returns {number}
 */
function calcTerritory(game, i) {
    const c = i % game.cols;
    const r = (i - c) / game.cols;
    let g = gameCopy(game);
    updateboard(r, c, game.turn, g);
    return g.owned[game.turn];
}

/**
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function randrange(lo, hi) {
    return Math.floor(Math.random()*(hi-lo))+lo;
}
/**
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function choice(arr) {
    return arr[randrange(0, arr.length)];
}

/**@type {TerriAI} */
const RandomAI = (game) => {
    return choice(getValidMoves(game));
};

/**@type {TerriAI} */
const DumbAI = (game) => {
    const moves = getValidMoves(game);
    const volmoves = moves.filter((v) => isVolatile(game, v));
    if (volmoves.length) return choice(volmoves);
    return choice(getValidMoves(game).sort((a, b) => compareCloseVolatile(game, a, b)).filter((v, i, a) => compareCloseVolatile(game, v, a[0]) === 0));
};

/**@type {TerriAI} */
const SimpleAI = (game) => {
    const moves = getValidMoves(game);
    let best = [0];
    let mostv = calcTerritory(game, moves[0]);
    for (let i = 1; i < moves.length; i ++) {
        let nterri = calcTerritory(game, moves[i]);
        if (nterri > mostv) {
            best = [i];
            mostv = nterri;
        } else if (nterri === mostv) {
            best.push(i);
        }
    }
    return moves[choice(best)];
};

exports.RandomAI = RandomAI;
exports.DumbAI = DumbAI;
exports.SimpleAI = SimpleAI;
