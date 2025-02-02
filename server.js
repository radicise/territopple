var dbg = 1;
let gameamnt = 4;
let playeramnt = 3;// Includes player zero (i. e. the neutral team)
let games = new Array(gameamnt);
for (let i = games.length; i >= 0; i--) {
	games[i] = null;
}
console.log("Starting server . . .");
var ws = require("ws");
var wserv = new ws.Server({"port":8301});
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
	let gmn = (-1);
	for (let i = 0; i < gameamnt; i++) {
		if (games[i] === null) {
			continue;
		}
		if (games[i]["started"]) {
			continue;
		}
		gmn = i;
		break;
	}
	if (gmn == (-1)) {
		for (let i = 0; i < gameamnt; i++) {
			if (games[i] === null) {
				gmn = i;
				break;
			}
		}
		if (gmn == (-1)) {
			wsock.send("disc3");// "NO GAME ROOMS ARE READY TO BE JOINED"
			wsock.close();
			wsock.terminate();
			return;
		}
		games[gmn] = genGame(5, 5);
		games[gmn]["index"] = gmn;
	}
	let game = games[gmn];
	let pln = game["players"].length;
	game["players"].push(wsock);
	if (dbg) {
		console.log("Player assignment to game " + gmn.toString());
	}
	wsock.send("room" + gmn.toString() + "_" + pln.toString());
	if (game["players"].length >= playeramnt) {
		game["started"] = 1;
		game["turn"] = 1;
		game["move"] = (-1);
		distrMess("turn" + game["turn"].toString() + "_" + game["move"].toString(), game);
	}
	else {
		distrMess("plyw" + (game["players"].length - 1).toString() + "_" + (playeramnt - 1).toString(), game);
	}
	let cols = game["cols"];
	let rows = game["rows"];
	let board = game["board"];
	let teamboard = game["teamboard"]
	wsock.on("message", data => {
		let whole = data.toString("utf8");
		var type = whole.substring(0, 4);
		var mess = whole.substring(4);
		switch (type) {
			case ("move"):
				if (dbg) {
					console.log("Player attempt to move");
				}
				if (!(game["started"])) {
					return;
				}
				if (game["turn"] != pln) {
					return;
				}
				if (dbg) {
					console.log("Player move");
				}
				mess = mess.substring(1);
				mess = mess.split("c");
				if (mess.length != 2) {
					break;
				}
				let row = parseInt(mess[0]);
				let col = parseInt(mess[1]);
				if ((isNaN(col) || ((col < 0) || (col >= cols))) || (isNaN(row) || ((row < 0) || (row >= rows)))) {
					wsock.send("disc1");// "INVALID INPUT"
					removePlayer(game, pln);
					wsock.close();
					wsock.terminate();
					break;
				}
				let spt = (row * cols) + col;
				if (teamboard[spt] && (teamboard[spt] != pln)) {
					break;
				}
				if (updateboard(row, col, pln, game)) {
					distrMess("wnnr" + pln.toString() + "_0", game);
					distrMess("disc4", game);// "GAME ENDED"
					killGame(game);
					return;
				}
				game["move"] = spt;
				let mmsg = "pcmtr" + (row.toString()) + "c" + (col.toString()) + "_" + (pln.toString());
				distrMess(mmsg, game);
				let nxpl = (-1);
				for (let i = pln + 1; i < playeramnt; i++) {
					if (game["players"][i] === null) {
						continue;
					}
					nxpl = i;
					break;
				}
				if (nxpl == (-1)) {
					for (let i = 0; i < (pln + 1); i++) {
						if (game["players"][i] === null) {
							continue;
						}
						nxpl = i;
						break;
					}
				}
				if (nxpl == (-1)) {// The game ended?????
					games[gmn] = null;
					return;
				}
				game["turn"] = nxpl;
				distrMess("turn" + game["turn"].toString() + "_" + game["move"].toString(), game);
				break;
			default:
				removePlayer(game, pln);
				wsock.send("disc2");// "INVALID DATA"
				wsock.close();
				wsock.terminate();
		}
		return;
	});
	if (dbg) {
		console.log("Client data handler establishment");
	}
	wsock.on("error", code => {
		removePlayer(game, pln);
		wsock.terminate();
		return;
	});
	return;
});
function distrMess(mmsg, game) {
	for (let i = 0; i < game["players"].length; i++) {
		if (game["players"][i] === null) {
			continue;
		}
		game["players"][i].send(mmsg);// TODO Does this block?
	}
}
function updateboard(rorig, corig, team, game) {
	let rows = game["rows"];
	let cols = game["cols"];
	let tiles = rows * cols;
	let board = game["board"];
	let teamboard = game["teamboard"];
	let adds = [corig, rorig];
	while (adds.length) {
		let row = adds.pop();
		let col = adds.pop();
		let nv = ++(board[(row * cols) + col]);
		let nm = 5;
		if ((col == 0) || (col == (cols - 1))) {
			nm--;
		}
		if ((row == 0) || (row == (rows - 1))) {
			nm--;
		}
		if (nv >= nm) {
			board[(row * cols) + col] -= (nm - 1);
			if (col != 0) {
				adds.push(col - 1);
				adds.push(row);
			}
			if (col != (cols - 1)) {
				adds.push(col + 1);
				adds.push(row);
			}
			if (row != 0) {
				adds.push(col);
				adds.push(row - 1);
			}
			if (row != (rows - 1)) {
				adds.push(col);
				adds.push(row + 1);
			}
		}
		if (teamboard[(row * cols) + col] != team) {
			game["owned"][teamboard[(row * cols) + col]]--;
			teamboard[(row * cols) + col] = team;
			if ((++game["owned"][team]) == tiles) {
				return 1;
			}
		}
	}
	return 0;
}
function genGame(rows, cols) {
	let board = new Array(cols * rows);
	let teamboard = new Array(cols * rows);
	for (let i = (cols * rows) - 1; i >= 0; i--) {
		board[i] = 1;
		teamboard[i] = 0;
	}
	let game = {};
	game["rows"] = rows;
	game["cols"] = cols;
	game["board"] = board;
	game["teamboard"] = teamboard;
	game["started"] = 0;
	game["players"] = [null];
	game["owned"] = new Array(playeramnt);
	for (let i = playeramnt; i >= 0; i--) {
		game["owned"][i] = 0;
	}
	return game;
}
function removePlayer(game, pln) {
	game["players"][pln] = null;
	let nxpl = (-1);
	for (let i = pln + 1; i < playeramnt; i++) {
		if (game["players"][i] === null) {
			continue;
		}
		nxpl = i;
		break;
	}
	if (nxpl == (-1)) {
		for (let i = 0; i < (pln + 1); i++) {
			if (game["players"][i] === null) {
				continue;
			}
			nxpl = i;
			break;
		}
	}
	if (nxpl == (-1)) {// This should not be possible . . . the game ended?????
		games[game["index"]] = null;
		return;
	}
	game["turn"] = nxpl;
	distrMess("turn" + game["turn"].toString() + "_" + game["move"].toString(), game);
	return;
}
function killGame(game) {
	for (let i = 0; i < game["players"].length; i++) {
		if (game["players"][i] === null) {
			continue;
		}
		game["players"][i].close();// TODO Does this block?
		game["players"][i].terminate();//TODO Does this block?
	}
	games[game["index"]] = null;
	return;
}
