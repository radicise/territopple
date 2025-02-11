const dbg = 1;
let maxGameAmount = 4;

const codeChars = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "4", "5", "6", "7", "8", "9"];// THE LENGTH OF `codeChars' MUST BE A POWER OF TWO

const { updateboard } = require("./serverhelpers.js");
const { RandomAI, DumbAI, SimpleAI } = require("./terriai.js");

/**
 * @typedef Game
 * @type {{rows:number,cols:number,board:number[],teamboard:number[],state:number,index:number,players:import("ws").WebSocket[],owned:number[],turn:number,move:number}}
 */

/**@type {Game[]} */
const games = {};
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
const _path = require("path");
const http = require("http");
const crypto = require("crypto");
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
const wserv = new ws.Server({"port":settings.GAMEPORT});
const hserv = http.createServer((requ, resp) => {// TODO Check request target
	if (dbg) {
		console.log("fetching of the room list");
	}
	let liststr = "";
	for (const id in games) {
		const game = games[id];
		if (game.pub) {
			liststr += `${id}_${game.cols}_${game.rows}_${game.state}_${game.connectedAmount}_${game.inGameAmount}_${game.playerAmount};`;// TODO Use correct values for amounts of players in room and playing in room
		}
	}
	resp.writeHead(200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
	resp.end(liststr);
	return;
});
hserv.listen(settings.LISTPORT);
/*
 * Properties of a game:
 *
 * "rows" - Amount of rows on the game board
 * "cols" - Amount of columns on the game board
 * "board" - Array of amount of pieces on the tiles of the board
 * "teamboard" - Array of teams occupying tiles on the board
 * "state" - 0 if the game has not started, 1 if the game has started and it still ongoing, and 2 if the game has ended
 * "ident" - key of the game in the game-holding object
 * "players" - Array of wsocks defining the players' connections, in player order, 1-indexed (element at index 0 is null)
 * "owned" - Array listing how many tiles each player possesses, in player order
 * The following are only present after the game has been started:
 * "turn" - Number defining the 1-indexed number of the player whose turn it is
 * "move" - Index of board tile on which the last move was played, -1 if no move has yet been played
 *
 */
wserv.on("connection", (wsock, req) => {
	let params = null;
	try {
		params = (new URL(`http://localhost${req.url}`)).searchParams;
	} catch (et) {
		if(dbg) {
			console.log("URL object creation exception");
		}
		return;
	}
	let connType = getParamInt("t", 0, 3, 0, params);
	let requeWidth = getParamInt("w", 1, 37, 6, params);
	let requeHeight = getParamInt("h", 1, 37, 6, params);
	let requePlayers = getParamInt("p", 2, 10, 2, params);
	if (dbg) {
		console.log("Connection");
	}
	let gameID = "--------";
	let game = null;
	let playerNum = 0;
	switch (connType) {
		case (0):// join game
			gameID = params.get("g");
			if (gameID === null) {
				wsock.send("disc3");// "GAME IDENTIFIER PARAMETER NOT PRESENT"
				wsock.close();
				wsock.terminate();
				return;
			}
			if (!(gameID in games)) {
				wsock.send("disc4");// "GAME DOES NOT EXIST"
				wsock.close();
				wsock.terminate();
				return;
			}// TODO Should the socket be closed and terminated immediately?
			if (games[gameID].state != 0) {
				wsock.send("disc5");// "GAME HAS ALREADY STARTED" // TODO Allow spectation
				wsock.close();
				wsock.terminate();
				return;
			}// TODO Should the socket be closed and terminated immediately?
			game = games[gameID];
			playerNum = 0;
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
			game.connectedAmount++;
			game.inGame[playerNum] = 1;
			game.inGameAmount++;
			if (dbg) {
				console.log("Player assignment to game " + gameID);
			}
			wsock.send(`room${gameID}_${playerNum}`);
			wsock.send(`dims${game.rows}_${game.cols}`);
			if (playerNum == game.playerAmount) {
				game.state = 1;
				game.turn = 1;
				game.move = -1;
				distrMess(`turn${game.turn}_${game.move}`, game);
			} else {
				distrMess(`plyw${game.inGameAmount}_${game.playerAmount}`, game);
			}
			break;
		case (1):// create new public game
		case (2):// create new private game
			playerNum = 1;
			gameID = genCode();
			game = genGame(requeWidth, requeHeight, requePlayers, connType === 1 ? 1 : 0);
			game.inGame[1] = 1;
			game.inGameAmount = 1;
			game.connectedAmount = 1;
			games[gameID] = game;
			game.ident = gameID;
			game.players.push(wsock);
			wsock.send(`room${gameID}_1`);
			wsock.send(`dims${game.rows}_${game.cols}`);
			distrMess(`plyw${game.inGameAmount}_${game.playerAmount}`, game);// TODO rename `playerAmount' property
			break;
		default:
			wsock.send("disc6");
			wsock.close();
			wsock.terminate();
			return;
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
				for (let i = playerNum + 1; i <= game.playerAmount; i++) {
					if (!(game.inGame[i])) {
						continue;
					}
					next_player = i;
					break;
				}
				if (next_player === -1) {
					for (let i = 1; i < (playerNum + 1); i++) {
						if (!(game.inGame[i])) {
							continue;
						}
						next_player = i;
						break;
					}
				}
				if (next_player === -1) {// This should not be possible . . . the game ended?????
					console.log("UNEXPECTED: Lack of next player");
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
 * @param {number} width
 * @param {number} height
 * @param {number} player_amount
 * @param {boolean} public
 * @returns {Game}
 */
function genGame(width, height, player_amount, public) {
	return {
		rows:height,
		cols:width,
		board:new Array(height * width).fill(1),
		teamboard:new Array(height * width).fill(0),
		state:0,
		players:[null],
		owned:(new Array(player_amount + 1)).fill(height * width, 0, 1).fill(0, 1, player_amount + 1),
		inGame:(new Array(player_amount + 1)).fill(0, 0, player_amount + 1),
		inGameAmount: 0,
		connectedAmount: 0,
		playerAmount: player_amount,
		pub: public
	};
}
/**
 * @param {Game} game
 * @param {number} playerNum
 */
function removePlayer(game, playerNum) {
	game.players[playerNum] = null;
	game.connectedAmount--;
	if (game.state == 0) {
		game.inGame[playerNum] = 0;
		game.inGameAmount--;
		if (!(game.inGameAmount)) {
			killGame(game);
			return;
		}
		distrMess(`plyw${game.inGameAmount}_${game.playerAmount}`, game);
		return;
	}
	if (game.turn != playerNum) {
		return;
	}
	game.inGame[playerNum] = 0;
	game.inGameAmount--;
	if ((!(game.inGameAmount)) && (game.state == 1)) {
		killGame(game);
		return;
	}
	let next_player = -1;
	for (let i = playerNum + 1; i <= game.playerAmount; i++) {
		if (!(game.inGame[i])) {
			continue;
		}
		next_player = i;
		break;
	}
	if (next_player === -1) {
		for (let i = 1; i < (playerNum + 1); i++) {
			if (!(game.inGame[i])) {
				continue;
			}
			next_player = i;
			break;
		}
	}
	if (game.state == 1) {
		if (next_player == (-1)) {
			console.log("UNEXPECTED: Game running out of players while claiming it had players");
			killGame(game);
			return;
		}
		game.turn = next_player;
		distrMess(`turn${game.turn}_${game.move}`, game);
		return;
	}
	if (next_player == (-1)) {
		console.log("UNEXPECTED: Game running out of players while claiming it had players");
	}
	game.turn = next_player;
	return;
}
/**
 * @param {Game} game
 */
function killGame(game) {
	delete games[game.ident];
	game.state = 2;
	game.inGameAmount = 0;
	for (let i = Math.min(game.playerAmount, game.players.length - 1); i; i--) {
		if (game.players[i]) {
			game.inGameAmount++;
			game.inGame[i] = 1;
		}
	}
	return;
}
function getParamInt(paramstr, lbincl, ubexcl, defau, params) {
	let num = params.get(paramstr);
	if (num == null) {
		if (dbg) {
			console.log("sanitation of invalid parameter");
		}
		return defau;
	}
	num = parseInt(num);
	if (isNaN(num)) {
		if (dbg) {
			console.log("sanitation of invalid parameter");
		}
		return defau;
	}
	if ((num < lbincl) || (num >= ubexcl)) {
		if (dbg) {
			console.log("sanitation of invalid parameter");
		}
		return defau;
	}
	return num;
}
function genCode() {
	const len = 8;
	const arr = new Uint16Array(len);
	let code = "";
	while (1) {
		crypto.getRandomValues(arr);
		for (let i = len; i; i--) {
			code += codeChars[arr.at(i - 1) % codeChars.length];
		}
		if (code in games) {
			code = "";
			continue;
		}
		break;
	}
	return code;
}
