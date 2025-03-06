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
 * @param {number} row
 * @param {number} col
 * @returns {Buffer}
 */
function formatMoveData(game, row, col) {
    switch (getFlag(game, 6, 2)) {
        case 0:
            return Buffer.of(((row >> 3) & 3), (row & 7) | col);
        case 1:
            return Buffer.of(row, col);
        case 2:
            return Buffer.of((row & 0xf00)>>8, row & 0xff, (col & 0xf00)>>8, col & 0xff);
        default:
            return Buffer.of(...nbytes(row, 2), ...nbytes(col, 2));
    }
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
 * @param {boolean|null} order whether non-standard order data is to be recorded, defaults to false
 * @description
 * MUST be called at the moment the game object is created but only AFTER the game identifier is set
 */
function onGameCreated(game, timestamp, order) {
    // game.buffer = [Buffer.of(FORMAT_VERSION, ...game.ident.split('').map(v => v.charCodeAt(0)), ((timestamp?(1<<7):0)|(1<<5)|(((typeof order)!=="number")?0:(1<<4))))];
    const maxD = Math.max(game.rows, game.cols);
    const size = (maxD <= 36) ? 0 : ((maxD <= 256) ? 1 : ((maxD <= 4096) ? 2 : 3));
    game.buffer = [Buffer.of(FORMAT_VERSION, ...game.ident.split('').map(v => v.charCodeAt(0)), ((timestamp?(1<<7):0)|(size<<5)|((order?1:0)<<4)))];
    // game.buffer.push(Buffer.from(gameID.split('').map(v => v.charCodeAt(0))));
    // game.buffer.push(Buffer.of((settings.REPLAYS.TIMESTAMP?(1<<7):0) | (0b01<<5))); // use timestamp from settings, use medium as it's the largest that doesn't use more bytes
}

/**
 * @summary final game initialization
 * @param {import("./server").Game} game
 * @param {number?} idstrategy what strategy is used to record extra move data
 * @param {number[]?} team_map map from player ids to team ids
 * @description
 * MUST be called when the game state changes to being in progress
 */
function onGameStarted(game, idstrategy, team_map) {
    game.timestamp = Date.now();
    if (getFlag(game, 4, 1) === 1) {
        game.idstrategy = idstrategy;
    }
    // console.log(game.timestamp);
    game.buffer.push(Buffer.of(...nbytes(game.timestamp, 8), ...nbytes(game.cols, 2), ...nbytes(game.rows, 2), game.players.length-1, ...((getFlag(game, 4, 1) === 1) ? [idstrategy, ...team_map] : []), 0xf0, 0x0f));
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
		let dtime = ntime - game.timestamp;
		game.timestamp = ntime;
		while (dtime > 65535) {
			game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3)));
            dtime = Math.max(0, dtime - 65535);
		}
		game.buffer.push(Buffer.of(0, ...nbytes(dtime, 2)));
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
 * @param {number} id player id
 * @description
 * MUST be called ANY time a successful move is made
 */
function onMove(game, row, col, id) {
    // if (game.buffer[0][9] & (1<<7)) {
    if (getFlag(game, 7, 1)) {
        const ntime = Date.now();
        let dtime = ntime - game.timestamp;
        game.timestamp = ntime;
        while (dtime > 65535) {
            game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3)));
            dtime = Math.max(0, dtime - 65535);
        }
        game.buffer.push(Buffer.of(1, ...nbytes(dtime, 2)));
    } else {
        game.buffer.push(Buffer.of(1));
    }
    let md = formatMoveData(game, row, col);
    if (game.idstrategy === 0) {
        if (getFlag(game, 6, 2) === 0) {
            md[0] = (id << 2) | md[0];
        } else {
            game.buffer.push(Buffer.of(id));
        }
    }
    game.buffer.push(md);
    // game.buffer.push(Buffer.of(row&0xff, col&0xff));
}

exports.onGameCreated = onGameCreated;
exports.onGameStarted = onGameStarted;
exports.onRecordReplay = onRecordReplay;
exports.onPlayerRemoved = onPlayerRemoved;
exports.onMove = onMove;
