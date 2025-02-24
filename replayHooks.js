const fs = require("fs");
const path = require("path");

const FORMAT_VERSION = 2;

/**
 * @param {BigInt} n
 * @param {number} c
 * @returns {number[]}
 */
function nbytes(n, c) {
    n = BigInt(n);
    console.log(n, c);
	return [n&0xffn,(n>>8n)&0xffn,(n>>16n)&0xffn,(n>>24n)&0xffn,(n>>32n)&0xffn,(n>>40n)&0xffn,(n>>48n)&0xffn,(n>>56n)&0xffn].map(v => Number(v)).slice(0, c).reverse();
}

/**
 * @param {import("./server").Game} game
 * @param {number} p MSB of flag
 * @param {number} l bits in flag
 */
function getFlag(game, p, l) {
    return (
        (
            game.buffer[0][9]
            & (
                (
                    (0xff << (8-l)) // have l 1s on MSB side of first byte
                    & 0xff // clip extraneous ones
                ) >> (7-p) // shift mask into position
            ) // mask
        ) >> (p-l+1) // shift flag bits toward LSB position
    );
}

/**
 * @summary initializes replay file buffer
 * @param {import("./server").Game} game
 * @param {boolean} timestamp MUST directly pass settings.REPLAYS.TIMESTAMP
 * @description
 * MUST be called at the moment the game object is created but only AFTER the game identifier is set
 */
function onGameCreated(game, timestamp) {
    game.buffer = [Buffer.of(FORMAT_VERSION, ...game.ident.split('').map(v => v.charCodeAt(0)), ((timestamp?(1<<7):0)|(1<<5)))];
    // game.buffer.push(Buffer.from(gameID.split('').map(v => v.charCodeAt(0))));
    // game.buffer.push(Buffer.of((settings.REPLAYS.TIMESTAMP?(1<<7):0) | (0b01<<5))); // use timestamp from settings, use medium as it's the largest that doesn't use more bytes
}

/**
 * @summary final game initialization
 * @param {import("./server").Game} game
 * @description
 * MUST be called when the game state changes to being in progress
 */
function onGameStarted(game) {
    game.timestamp = Date.now();
    // console.log(game.timestamp);
    game.buffer.push(Buffer.of(...nbytes(game.timestamp, 8), ...nbytes(game.cols, 2), ...nbytes(game.rows, 2), game.players.length-1, 0xf0, 0x0f));
}

/**
 * @summary writes the replay file to disk
 * @param {import("./server").Game} game
 * @param {Object} [options]
 * @param {string} [options.filepath] path to write the replay to, defaults to "replays/[game.ident].topl"
 * @param {boolean} [options.append] whether to append to the given file or overwrite it, defaults to false
 * @description
 * may ONLY be called ONCE, when the game is over
 * it is NOT necessary for the game to have finished in a player winning
 * a game ending early IS a valid reason to call this, so long as the provided game object instance (specifically its buffer) CANNOT be used to resume it later
 */
function onRecordReplay(game, options) {
    options = options ?? {};
    options.filepath = path.join(__dirname, options.filepath ?? `replays/${game.ident}.topl`);
    options.append = options.append ?? false;
    game.buffer.push(Buffer.of(0xff, 0xf0, 0x0f, 0xff));
    const data = Buffer.concat(game.buffer);
    if (options.append) {
        fs.appendFileSync(options.filepath, data);
    } else {
        fs.writeFileSync(options.filepath, data);
    }
    // game.buffer.push(Buffer.of(0xff, 0xf0, 0x0f, 0xff));
    // for (let i = 0; i < game.buffer.length; i ++) {
    //     if (typeof game.buffer[i] === "number") {
    //         console.log(`${i}: ${game.buffer[i]}\n${JSON.stringify(game.buffer[i-1])}\n${JSON.stringify(game.buffer[i+1])}`);
    //     }
    // }
    // if (settings.REPLAYS.ENABLED)fs.writeFileSync("replays/"+game.ident+".topl", Buffer.concat(game.buffer));
}
/**
 * @summary records the removal of a player from the turn order
 * @param {import("./server").Game} game
 * @param {number} playerNum index of player that was removed
 * @description
 * MUST be called whenever a player is removed from the turn order for ANY reason
 */
function onPlayerRemoved(game, playerNum) {
    // if (game.buffer[0][9] & (1<<7)) {
    if (getFlag(game, 7, 1)) {
		const ntime = Date.now();
		const dtime = ntime - game.timestamp;
		game.timestamp = ntime;
		if (dtime > 65535) {
			game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3), 0, 0, 0));
		} else {
			// game.buffer.push(Buffer.of(0, ...toBytes(dtime)));
			game.buffer.push(Buffer.of(0, ...nbytes(dtime, 2)));
		}
	} else {
		game.buffer.push(Buffer.of(0));
	}
	game.buffer.push(Buffer.of(playerNum));
}
/**
 * @summary records a player move
 * @param {import("./server").Game} game
 * @param {number} row
 * @param {number} col
 * @param {number} team
 * @description
 * MUST be called ANY time a successful move is made
 */
function onMove(game, row, col, team) {
    // if (game.buffer[0][9] & (1<<7)) {
    if (getFlag(game, 7, 1)) {
        const ntime = Date.now();
        const dtime = ntime - game.timestamp;
        game.timestamp = ntime;
        if (dtime > 65535) {
            game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3), 1, 0, 0));
        } else {
            game.buffer.push(Buffer.of(1, ...nbytes(dtime, 2)));
        }
    } else {
        game.buffer.push(Buffer.of(1));
    }
    game.buffer.push(Buffer.of(row&0xff, col&0xff));
}

exports.onGameCreated = onGameCreated;
exports.onGameStarted = onGameStarted;
exports.onRecordReplay = onRecordReplay;
exports.onPlayerRemoved = onPlayerRemoved;
exports.onMove = onMove;
