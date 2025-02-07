const dbg = 1;
let gameAmount = 4;// Public
let gamesTotal = 8;// Both public and private

const { updateboard } = require("./serverhelpers.js");
const { RandomAI, DumbAI, SimpleAI } = require("./terriai.js");

/**
 * @typedef Game
 * @type {{rows:number,cols:number,board:number[],teamboard:number[],state:number,index:number,players:import("ws").WebSocket[],owned:number[],turn:number,move:number}}
 */

/**@type {Game[]} */
const games = new Array(gamesTotal);
// don't need all this?
for (let i = games.length; i >= 0; i--) {
	games[i] = null;
}
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
const _path = require("path");
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
let playerAmount = settings.PLAYERAMOUNT;
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
	let connType = null;
	try {
		(new URL(`http://localhost${req.url}`)).searchParams.get(t);
	} catch (et) {
		connType = null;
	}
	if (connType == null) {
		connType = "0";
	}
	connType = parseInt(connType);
	if (isNaN(connType)) {
		connType = 0;
	}
	if (dbg) {
		console.log("Connection");
	}
	let gameNum = -1;
	for (let i = 0; i < gameAmount; i++) {
		if (!games[i]) continue;
		if (games[i].state != 0) continue;
		gameNum = i;
		break;
	}
	if (gameNum === -1) {
		for (let i = 0; i < gameAmount; i++) {
			if (!games[i]) {
				gameNum = i;
				break;
			}
		}
		if (gameNum === -1) {
			wsock.send("disc3");// "NO GAME ROOMS ARE READY TO BE JOINED"
			wsock.close();
			wsock.terminate();
			return;
		}
		games[gameNum] = genGame();
		games[gameNum].index = gameNum;
	}
	let game = games[gameNum];
	let playerNum = 0;
	for (let i = 1; i < game.players.length; i++) {
		if (game.players[i] === null) {
			playerNum = i;
			game.players[playerNum] = wsock;
			break;
		}
	}
	if (!playerNum) {
		playerNum = game.players.length;
		game.players.push(wsock);
	}
	if (dbg) {
		console.log("Player assignment to game " + gameNum.toString());
	}
	wsock.send(`room${gameNum}_${playerNum}`);
	if (playerNum == playerAmount) {
		game.state = 1;
		game.turn = 1;
		game.move = -1;
		distrMess(`turn${game.turn}_${game.move}`, game);
	} else {
		let current_turn = 0;
		for (let i = 1; i < game.players.length; i++) {
			if (!(game.players[i])) {
				continue;
			}
			current_turn++;
		}
		distrMess(`plyw${current_turn}_${playerAmount}`, game);
	}
	wsock.on("message", (data, bin) => {
		if (game === null) {
			return;
		}
		let whole = data.toString("utf8");
		let type = whole.substring(0, 4);
		let message = whole.substring(4);
		switch (type) {
			case ("move"):
				if (game.state != 1) return;
				if (dbg) {
					console.log("Player attempt to move");
				}
				if (game.turn != playerNum) return;
				if (dbg) {
					console.log("Player move");
				}
				message = message.substring(1);
				message = message.split("c");
				
				if (message.length != 2) break;
				
				let row = parseInt(message[0]);
				let col = parseInt(message[1]);
				
				if ((isNaN(col) || ((col < 0) || (col >= game.cols))) || (isNaN(row) || ((row < 0) || (row >= game.rows)))) {
					removePlayer(game, playerNum);
					game = null;
					wsock.send("disc1");// "INVALID INPUT"
					wsock.close();
					wsock.terminate();
					break;
				}
				
				let tile_index = (row * game.cols) + col;
				if (game.teamboard[tile_index] && (game.teamboard[tile_index] != playerNum)) break;
				let winner = updateboard(row, col, playerNum, game);
				game.move = tile_index;
				let next_player = -1;
				let boardFull = game.owned[0] == 0;
				for (let i = playerNum + 1; i <= playerAmount; i++) {
					if (!(game.players[i])) {
						continue;
					}
					if (boardFull && (game.owned[i] == 0)) {
						continue;
					}
					next_player = i;
					break;
				}
				if (next_player === -1) {
					for (let i = 0; i < (playerNum + 1); i++) {
						if (!(game.players[i])) {
							continue;
						}
						if (boardFull && (game.owned[i] == 0)) {
							continue;
						}
						next_player = i;
						break;
					}
				}
				if (next_player === -1) {// This should not be possible . . . the game ended?????
					killGame(game);
					return;
				}
				game.turn = next_player;
				if (winner) {
					distrMess(`wnnr${playerNum}_${game.move}`, game);
					killGame(game);// "GAME ENDED"
					return;
				}
				distrMess(`pcmtr${row}c${col}_${playerNum}`, game);
				distrMess(`turn${game.turn}_${game.move}`, game);
				const _fmtmov = (i) => {const c = i % game.cols;const r = (i - c) / game.cols;return `(${c}, ${r})`;};
				console.log(`rando: ${_fmtmov(RandomAI(game))}\ndummy: ${_fmtmov(DumbAI(game))}\nsimpl: ${_fmtmov(SimpleAI(game))}`);
				break;
			default:
				removePlayer(game, playerNum);
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
		removePlayer(game, playerNum);// TODO Should the client be given its disconnect sequence and for it have close() invoked?
		game = null;
		wsock.terminate();
	});
	wsock.on("close", (cod, reas) => {
		if (game === null) {
			return;
		}
		removePlayer(game, playerNum);
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
	return;
}
/**
 * @param {number} rows
 * @param {number} cols
 * @returns {Game}
 */
function genGame() {
	return {
		rows:settings.HEIGHT,
		cols:settings.WIDTH,
		board:new Array(settings.HEIGHT * settings.WIDTH).fill(1),
		teamboard:new Array(settings.HEIGHT * settings.WIDTH).fill(0),
		state:0,
		players:[null],
		owned:new Array(playerAmount + 1).fill(settings.HEIGHT * settings.WIDTH, 0, 1).fill(0, 1, playerAmount + 1)
	};
}
/**
 * @param {Game} game
 * @param {number} playerNum
 */
function removePlayer(game, playerNum) {
	game.players[playerNum] = null;
	if (game.state == 0) {
		let ps = 0;
		for (let i = 1; i <= playerAmount; i++) {
			if (game.players[i]) {
				ps++;
			}
		}
		if (!ps) {
			killGame(game);
			return;
		}
		distrMess(`plyw${ps}_${playerAmount}`, game);
		return;
	}
	if (game.turn != playerNum) {
		return;
	}
	let next_player = -1;
	let ntz = (game.owned[0] == 0) && (game.state == 1);
	for (let i = playerNum + 1; i <= playerAmount; i++) {
		if (!(game.players[i])) {
			continue;
		}
		if (ntz && (game.owned[i] == 0)) {
			continue;
		}
		next_player = i;
		break;
	}
	if (next_player === -1) {
		for (let i = 0; i < (playerNum + 1); i++) {
			if (!(game.players[i])) {
				continue;
			}
			if (ntz && (game.owned[i] == 0)) {
				continue;
			}
			next_player = i;
			break;
		}
	}
	if (game.state == 1) {
		if (next_player == (-1)) {
			killGame(game);
			return;
		}
		game.turn = next_player;
		distrMess(`turn${game.turn}_${game.move}`, game);
		return;
	}
	game.turn = next_player;
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
