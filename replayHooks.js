const fs = require("fs");
const path = require("path");

exports.onGameCreated = onGameCreated;
exports.onGameStarted = onGameStarted;
exports.onRecordReplay = onRecordReplay;
exports.onPlayerRemoved = onPlayerRemoved;
exports.onMove = onMove;

if (!fs.existsSync("gameid.bin")) {
    fs.writeFileSync("gameid.bin", Buffer.alloc(8, 0));
}

/**
 * @returns {Buffer}
 */
function allocGameId() {
    const b = fs.readFileSync("gameid.bin");
    const wb = Buffer.allocUnsafe(8);
    wb.writeBigUInt64BE(b.readBigUInt64BE()+1n);
    fs.writeFileSync("gameid.bin", wb);
    return b;
}

// const { topology } = require("./defs.js");
const defs = require("./defs.js");
const topology = defs.topology;
const fingerprint = defs.fingerprint;

const FORMAT_VERSION = 4;

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
 * @param {import("./server").Game} game
 * @param {number} tile
 * @returns {Buffer}
 */
function formatMoveData(game, tile) {
    switch (getFlag(game, 6, 2)) {
        // case 0:
        //     return Buffer.of(((row >> 3) & 3), (row & 7) | col);
        // case 1:
        //     return Buffer.of(row, col);
        // case 2:
        //     return Buffer.of((row & 0xf00)>>8, row & 0xff, (col & 0xf00)>>8, col & 0xff);
        // default:
        //     return Buffer.of(...nbytes(row, 2), ...nbytes(col, 2));
        case 0:
            return Buffer.from(nbytes(tile, 1));
        case 1:
            return Buffer.from(nbytes(tile, 2));
        case 2:
            return Buffer.from(nbytes(tile, 3));
            // return Buffer.of((row & 0xf00)>>8, row & 0xff, (col & 0xf00)>>8, col & 0xff);
        case 3:
            return Buffer.from(nbytes(tile, 4));
        default:
            // return Buffer.of(...nbytes(row, 2), ...nbytes(col, 2));
            throw new Error("reserved");
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
 * @param {import("./defs").Game} game
 * @param {boolean} timestamp MUST directly pass settings.REPLAYS.TIMESTAMP
 * @param {boolean|null} order whether non-standard order data is to be recorded, defaults to false
 * @description
 * MUST be called at the moment the game object is created but only AFTER the game identifier is set
 */
function onGameCreated(game, timestamp, order) {
    // game.buffer = [Buffer.of(FORMAT_VERSION, ...game.ident.split('').map(v => v.charCodeAt(0)), ((timestamp?(1<<7):0)|(1<<5)|(((typeof order)!=="number")?0:(1<<4))))];
    const maxD = game.state.topology.tileCount;
    const size = (maxD <= 1024) ? 0 : ((maxD<=2<<18) ? 1 : ((maxD <= 4096) ? 2 : 3));
    game.buffer = [Buffer.of(FORMAT_VERSION, ...game.ident.split('').map(v => v.charCodeAt(0)), ((timestamp?(1<<7):0)|(size<<5)|((order?1:0)<<4)))];
    // game.buffer.push(Buffer.from(gameID.split('').map(v => v.charCodeAt(0))));
    // game.buffer.push(Buffer.of((settings.REPLAYS.TIMESTAMP?(1<<7):0) | (0b01<<5))); // use timestamp from settings, use medium as it's the largest that doesn't use more bytes
}

/**
 * @summary final game initialization
 * @param {import("./defs.js").Game} game
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
    const topologyData = [];
    if (getFlag(game, 3, 1) === 1) {
        topologyData.push(game.state.topology.originalData);
        topologyData.push(Buffer.of(
            0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,0xfe,
            0xff,0x33,0x00,0x55,0x22,0x88,0x66,0x44
        ));
    } else {
        const tid = topology.m.getTopologyId(game.state.topology);
        topologyData.push(...nbytes(tid, 2));
        switch (tid) {
            case 0:case 1:case 2:case 3:{
                topologyData.push(...nbytes(game.state.topology.width, 2));
            }
        }
    }
    // console.log(game.timestamp);
    game.buffer.push(Buffer.of(...nbytes(game.timestamp, 8), ...nbytes(game.state.topology.tileCount, 4), game.players.length-1, ...((getFlag(game, 4, 1) === 1) ? [idstrategy, ...team_map] : [])));
    if (Buffer.isBuffer(topologyData[0])) {
        game.buffer.push(...topologyData);
    } else {
        game.buffer.push(Buffer.from(topologyData));
    }
    game.buffer.push(Buffer.of(...allocGameId(), ...fingerprint, 0xf0, 0x0f));
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
    // console.log(new Error("TRACING"));
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
 * @param {import("./defs.js").Game} game
 * @param {number} tile
 * @param {number} id player id
 * @description
 * MUST be called ANY time a successful move is made
 */
function onMove(game, tile, id) {
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
    let md = formatMoveData(game, tile);
    if (game.idstrategy === 0) {
        // if (getFlag(game, 6, 2) === 0) {
        //     md[0] = (id << 2) | md[0];
        // } else {
        //     game.buffer.push(Buffer.of(id));
        // }
        switch (getFlag(game, 6, 2)) {
            case 0:
                md[0] = (md[0] & 0x1f) | (id<<5);
                break;
            case 1:
                md[0] = (md[0] & 3) | (id<<2);
                break;
            case 2:
                md[0] = id;
                break;
            case 3:
                md[0] = (id >> 4);
                md[1] = (md[1] & 0xf) | ((id & 0xf) << 4);
        }
    }
    game.buffer.push(md);
    // game.buffer.push(Buffer.of(row&0xff, col&0xff));
}
