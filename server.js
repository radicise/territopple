const dbg = 1;
let gameamnt = 4;
let playeramnt = 3;// Includes player zero (i. e. the neutral team)

/**
 * @typedef Game
 * @type {{rows:number,cols:number,board:number[],teamboard:number[],started:boolean,index:number,players:import("ws").WebSocket[],owned:number[],turn:number,move:number}}
 */

/**@type {Game[]} */
const games = new Array(gameamnt);
// don't need all this
// for (let i = games.length; i >= 0; i--) {
// 	games[i] = null;
// }
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
const _path = require("path");
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
// const wserv = new ws.Server({"port":8301});
const wserv = new ws.Server({"port":settings.GAMEPORT});
/*
 * Properties of a game:
 *
 * "rows" - Amount of rows on the game board
 * "cols" - Amount of columns on the game board
 * "board" - Array of amount of pieces on the tiles of the board
 * "teamboard" - Array of teams occupying tiles on the board
 * "started" - 0 if the game has not started, 1 if the game has started
 * "index" - Index of the game in the game array
 * "players" - Array of wsocks defining the players' connections, in player order, 1-indexed (element at index 0 is null)
 * "owned" - Array listing how many tiles each player possesses, in player order
 * The following are only present after the game has been started:
 * "turn" - Number defining the 1-indexed number of the player whose turn it is
 * "move" - Index of board tile on which the last move was played, -1 if no move has yet been played
 *
 */
wserv.on("connection", wsock => {
	if (dbg) {
		console.log("Connection");
	}
	let gmn = -1;
	for (let i = 0; i < gameamnt; i++) {
		if (!games[i]) continue;
		if (games[i].started) continue;
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
	const game = games[gmn];
	const pln = game.players.length;
	game.players.push(wsock);
	if (dbg) {
		console.log("Player assignment to game " + gmn.toString());
	}
	// wsock.send("room" + gmn.toString() + "_" + pln.toString());
	wsock.send(`room${gmn}_${pln}`);
	if (game.players.length >= playeramnt) {
		game.started = true;
		game.turn = 1;
		game.move = -1;
		// distrMess("turn" + game.turn.toString() + "_" + game.move.toString(), game);
		// more readable
		distrMess(`turn${game.turn}_${game.move}`, game);
	}
	else {
		// distrMess("plyw" + (game["players"].length - 1).toString() + "_" + (playeramnt - 1).toString(), game);
		distrMess(`plyw${game.players.length - 1}_${playeramnt - 1}`, game);
	}
	const cols = game.cols;
	const rows = game.rows;
	// let teamboard = game["teamboard"]
	wsock.on("message", data => {
		const whole = data.toString("utf8");
		const type = whole.substring(0, 4);
		let mess = whole.substring(4);
		switch (type) {
			case ("move"):
				if (dbg) {
					console.log("Player attempt to move");
				}
				
				if (!game.started) return;
				if (game.turn != pln) return;
				
				if (dbg) {
					console.log("Player move");
				}
				mess = mess.substring(1);
				mess = mess.split("c");
				
				if (mess.length != 2) break;
				
				const row = parseInt(mess[0]);
				const col = parseInt(mess[1]);
				
				if ((isNaN(col) || ((col < 0) || (col >= cols))) || (isNaN(row) || ((row < 0) || (row >= rows)))) {
					wsock.send("disc1");// "INVALID INPUT"
					removePlayer(game, pln);
					wsock.close();
					wsock.terminate();
					break;
				}
				
				const spt = (row * cols) + col;
				
				if (game.teamboard[spt] && (game.teamboard[spt] != pln)) break;
				
				if (updateboard(row, col, pln, game)) {
					// distrMess("wnnr" + pln.toString() + "_0", game);
					distrMess(`wnnr${pln}_0`, game);
					distrMess("disc4", game);// "GAME ENDED"
					killGame(game);
					return;
				}
				game.move = spt;
				// let mmsg = "pcmtr" + (row.toString()) + "c" + (col.toString()) + "_" + (pln.toString());
				distrMess(`pcmtr${row}c${col}_${pln}`, game);
				let nxpl = -1;
				for (let i = pln + 1; i < playeramnt; i++) {
					if (!game.players[i]) continue;
					nxpl = i;
					break;
				}
				if (nxpl === -1) {
					for (let i = 0; i < (pln + 1); i++) {
						if (!game.players[i]) continue;
						nxpl = i;
						break;
					}
				}
				if (nxpl === -1) {// The game ended?????
					games[gmn] = null;
					return;
				}
				game.turn = nxpl;
				// distrMess("turn" + game.turn.toString() + "_" + game.move.toString(), game);
				distrMess(`turn${game.turn}_${game.move}`, game);
				break;
			default:
				removePlayer(game, pln);
				wsock.send("disc2");// "INVALID DATA"
				wsock.close();
				wsock.terminate();
		}
	});
	if (dbg) {
		console.log("Client data handler establishment");
	}
	wsock.on("error", _ => {
		removePlayer(game, pln);
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
 * @param {number} rorig
 * @param {number} corig
 * @param {number} team
 * @param {Game} game
 * @returns {boolean}
 */
function updateboard(rorig, corig, team, game) {
	const rows = game.rows;
	const cols = game.cols;
	const tiles = rows * cols;
	const adds = [corig, rorig];
	while (adds.length) {
		const row = adds.pop();
		const col = adds.pop();
		let nv = ++(game.board[(row * cols) + col]);
		let nm = 5;
		if ((col == 0) || (col == (cols - 1))) {
			nm--;
		}
		if ((row == 0) || (row == (rows - 1))) {
			nm--;
		}
		if (nv >= nm) {
			game.board[(row * cols) + col] -= (nm - 1);
			if (col != 0) {
				adds.push(col - 1, row);
			}
			if (col != (cols - 1)) {
				adds.push(col + 1, row);
			}
			if (row != 0) {
				adds.push(col, row - 1);
			}
			if (row != (rows - 1)) {
				adds.push(col, row + 1);
			}
		}
		if (game.teamboard[(row * cols) + col] != team) {
			game.owned[game.teamboard[(row * cols) + col]]--;
			game.teamboard[(row * cols) + col] = team;
			if ((++game.owned[team]) == tiles) {
				return true;
			}
		}
	}
	return false;
}
/**
 * @param {number} rows
 * @param {number} cols
 * @returns {Game}
 */
function genGame(rows, cols) {
	// let board = new Array(cols * rows);
	// let teamboard = new Array(cols * rows);
	// for (let i = (cols * rows) - 1; i >= 0; i--) {
	// 	board[i] = 1;
	// 	teamboard[i] = 0;
	// }
	// this is much more concise
	// let game = {
	return {
		rows:rows,
		cols:cols,
		board:new Array(rows * cols).fill(1),
		// board:board,
		teamboard:new Array(rows * cols).fill(0),
		// teamboard:teamboard,
		started:false,
		players:[null],
		owned:[].fill(0, 0, playeramnt)
	};
	// game["rows"] = rows;
	// game["cols"] = cols;
	// game["board"] = board;
	// game["teamboard"] = teamboard;
	// game["started"] = 0;
	// game["players"] = [null];
	// game["owned"] = new Array(playeramnt);
	// for (let i = playeramnt; i >= 0; i--) {
	// 	game["owned"][i] = 0;
	// }
	// return game;
}
/**
 * @param {Game} game
 * @param {number} pln
 */
function removePlayer(game, pln) {
	game.players[pln] = null;
	let nxpl = -1;
	for (let i = pln + 1; i < playeramnt; i++) {
		if (!game.players[i]) continue;
		nxpl = i;
		break;
	}
	if (nxpl === -1) {
		for (let i = 0; i < (pln + 1); i++) {
			if (!game.players[i]) continue;
			nxpl = i;
			break;
		}
	}
	if (nxpl === -1) {// This should not be possible . . . the game ended?????
		games[game.index] = null;
		return;
	}
	game.turn = nxpl;
	// distrMess("turn" + game["turn"].toString() + "_" + game["move"].toString(), game);
	distrMess(`turn${game.turn}_${game.move}`, game);
}
/**
 * @param {Game} game
 */
function killGame(game) {
	for (let i = 0; i < game.players.length; i++) {
		if (!game.players[i]) continue;
		game.players[i].close();// TODO Does this block?
		game.players[i].terminate();//TODO Does this block?
	}
	games[game.index] = null;
}
