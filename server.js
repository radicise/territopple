const dbg = 1;
let gameamnt = 4;// Public
let gamestotal = 8;// Both public and private
let playeramnt = 2;

const { updateboard } = require("./serverhelpers.js");
//const { RandomAI, DumbAI, SimpleAI } = require("./terriai.js");

/**
 * @typedef Game
 * @type {{rows:number,cols:number,board:number[],teamboard:number[],state:number,index:number,players:import("ws").WebSocket[],owned:number[],turn:number,move:number}}
 */

/**@type {Game[]} */
const games = new Array(gamestotal);
// don't need all this?
for (let i = games.length; i >= 0; i--) {
	games[i] = null;
}
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
const _path = require("path");
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
const wserv = new ws.Server({"port":settings.GAMEPORT});
/*
 * Properties of a game:
 *
 * "rows" - Amount of rows on the game board
 * "cols" - Amount of columns on the game board
 * "board" - Array of amount of pieces on the tiles of the board
 * "teamboard" - Array of teams occupying tiles on the board
 * "state" - 0 if the game has not started, 1 if the game has started and it still ongoing, and 2 if the game has ended
 * "index" - Index of the game in the game array
 * "players" - Array of wsocks defining the players' connections, in player order, 1-indexed (element at index 0 is null)
 * "owned" - Array listing how many tiles each player possesses, in player order
 * The following are only present after the game has been started:
 * "turn" - Number defining the 1-indexed number of the player whose turn it is
 * "move" - Index of board tile on which the last move was played, -1 if no move has yet been played
 *
 */
wserv.on("connection", (wsock, req) => {
	let cty = null;
	try {
		(new URL(`http://localhost${req.url}`)).searchParams.get(t);
	} catch (et) {
		cty = null;
	}
	if (cty == null) {
		cty = "0";
	}
	cty = parseInt(cty);
	if (isNaN(cty)) {
		cty = 0;
	}
	if (dbg) {
		console.log("Connection");
	}
	let gmn = -1;
	for (let i = 0; i < gameamnt; i++) {
		if (!games[i]) continue;
		if (games[i].state != 0) continue;
		gmn = i;
		break;
	}
	if (gmn === -1) {
		for (let i = 0; i < gameamnt; i++) {
			if (!games[i]) {
				gmn = i;
				break;
			}
		}
		if (gmn === -1) {
			wsock.send("disc3");// "NO GAME ROOMS ARE READY TO BE JOINED"
			wsock.close();
			wsock.terminate();
			return;
		}
		games[gmn] = genGame(5, 5);
		games[gmn].index = gmn;
	}
	let game = games[gmn];
	let plnmb = 0;
	for (let i = 1; i < game.players.length; i++) {
		if (game.players[i] === null) {
			plnmb = i;
			break;
		}
	}
	if (!plnmb) {
		plnmb = game.players.length;
		game.players.push(wsock);
	}
	if (dbg) {
		console.log("Player assignment to game " + gmn.toString());
	}
	let pln = plnmb;
	wsock.send(`room${gmn}_${pln}`);
	if (pln == playeramnt) {
		game.state = 1;
		game.turn = 1;
		game.move = -1;
		distrMess(`turn${game.turn}_${game.move}`, game);
	} else {
		let ct = 0;
		for (let i = 1; i < game.players.length; i++) {
			if (!(game.players[i])) {
				continue;
			}
			ct++;
		}
		distrMess(`plyw${ct}_${playeramnt}`, game);
	}
	wsock.on("message", (data, bin) => {
		if (game === null) {
			return;
		}
		let whole = data.toString("utf8");
		let type = whole.substring(0, 4);
		let mess = whole.substring(4);
		switch (type) {
			case ("move"):
				if (game.state != 1) return;
				if (dbg) {
					console.log("Player attempt to move");
				}
				if (game.turn != pln) return;
				if (dbg) {
					console.log("Player move");
				}
				mess = mess.substring(1);
				mess = mess.split("c");
				
				if (mess.length != 2) break;
				
				let row = parseInt(mess[0]);
				let col = parseInt(mess[1]);
				
				if ((isNaN(col) || ((col < 0) || (col >= game.cols))) || (isNaN(row) || ((row < 0) || (row >= game.rows)))) {
					removePlayer(game, pln);
					game = null;
					wsock.send("disc1");// "INVALID INPUT"
					wsock.close();
					wsock.terminate();
					break;
				}
				
				let spt = (row * game.cols) + col;
				if (game.teamboard[spt] && (game.teamboard[spt] != pln)) break;
				let wnr = updateboard(row, col, pln, game);
				game.move = spt;
				let nxpl = -1;
				let ntz = game.owned[0] == 0;
				for (let i = pln + 1; i <= playeramnt; i++) {
					if (!(game.players[i])) {
						continue;
					}
					if (ntz && (game.owned[i] == 0)) {
						continue;
					}
					nxpl = i;
					break;
				}
				if (nxpl === -1) {
					for (let i = 0; i < (pln + 1); i++) {
						if (!(game.players[i])) {
							continue;
						}
						if (ntz && (game.owned[i] == 0)) {
							continue;
						}
						nxpl = i;
						break;
					}
				}
				if (nxpl === -1) {// This should not be possible . . . the game ended?????
					killGame(game);
					return;
				}
				game.turn = nxpl;
				if (wnr) {
					distrMess(`wnnr${pln}_${game.move}`, game);
					killGame(game);// "GAME ENDED"
					return;
				}
				distrMess(`pcmtr${row}c${col}_${pln}`, game);
				distrMess(`turn${game.turn}_${game.move}`, game);
//				const _fmtmov = (i) => {const c = i % game.cols;const r = (i - c) / game.cols;return `(${c}, ${r})`;};
//				console.log(`rando: ${_fmtmov(RandomAI(game))}\ndummy: ${_fmtmov(DumbAI(game))}\nsimpl: ${_fmtmov(SimpleAI(game))}`);
				break;
			default:
				removePlayer(game, pln);
				game = null;
				wsock.send("disc2");// "INVALID DATA"
				wsock.close();
				wsock.terminate();
		}
		return;
	});
	if (dbg) {
		console.log("Client data handler establishment");
	}
	wsock.on("error", (er) => {
		if (game === null) {
			return;
		}
		if (dbg) {
			console.log("Client socket error");
		}
		removePlayer(game, pln);// TODO Should the client be given its disconnect sequence and for it have close() invoked?
		game = null;
		wsock.terminate();
	});
	wsock.on("close", (cod, reas) => {
		if (game === null) {
			return;
		}
		removePlayer(game, pln);
		game = null;
		wsock.terminate();
	});

});
/**
 * @param {any} mmsg
 * @param {Game} game
 * @returns {Promise<void>}
 */
function awaitableDistrMess(mmsg, game) {
	// promises can become blocking using the 'await' syntax
	return new Promise((r, _) => {
		let remaining = 0; // remaining dispatches to hear back from
		for (let i = 0; i < game.players.length; i ++) { // iterate through all players
			if (!game.players[i]) continue; // skip over disconnected / fake players
			remaining ++; // increment number of remaining dispatches
			game.players[i].send(mmsg, (_) => { // make dispatch
				remaining --;
				// there is no race condition because the loop is guaranteed to finish executing fully before any of the callback function instances are run
				if (!remaining) { // if this was the last remaining dispatch, resolve the promise
					r();
				}
			});
		}
	});
}
/**
 * @param {any} mmsg
 * @param {Game} game
 */
function distrMess(mmsg, game) {
	for (let i = 0; i < game.players.length; i++) {
		if (game.players[i] === null) {
			continue;
		}
		game.players[i].send(mmsg);// TODO Does this block?
	}
}
/**
 * @param {number} rows
 * @param {number} cols
 * @returns {Game}
 */
function genGame(rows, cols) {
	return {
		rows:rows,
		cols:cols,
		board:new Array(rows * cols).fill(1),
		teamboard:new Array(rows * cols).fill(0),
		state:0,
		players:[null],
		owned:new Array(playeramnt + 1).fill(rows * cols, 0, 1).fill(0, 1, playeramnt + 1)
	};
}
/**
 * @param {Game} game
 * @param {number} pln
 */
function removePlayer(game, pln) {
	game.players[pln] = null;
	if (game.state == 0) {
		return;
	}
	if (game.turn != pln) {
		return;
	}
	let nxpl = -1;
	let ntz = (game.owned[0] == 0) && (game.state == 1);
	for (let i = pln + 1; i <= playeramnt; i++) {
		if (!(game.players[i])) {
			continue;
		}
		if (ntz && (game.owned[i] == 0)) {
			continue;
		}
		nxpl = i;
		break;
	}
	if (nxpl === -1) {
		for (let i = 0; i < (pln + 1); i++) {
			if (!(game.players[i])) {
				continue;
			}
			if (ntz && (game.owned[i] == 0)) {
				continue;
			}
			nxpl = i;
			break;
		}
	}
	if (game.state == 1) {
		if (nxpl == (-1)) {
			killGame(game);
			return;
		}
		game.turn = nxpl;
		distrMess(`turn${game.turn}_${game.move}`, game);
		return;
	}
	game.turn = nxpl;
	return;
}
/**
 * @param {Game} game
 */
function killGame(game) {
	games[game.index] = null;
	game.state = 2;
	return;
}
