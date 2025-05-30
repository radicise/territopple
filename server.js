const dbg = 1;
let maxGameAmount = 4;

const codeChars = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "4", "5", "6", "7", "8", "9"];// THE LENGTH OF `codeChars' MUST BE A POWER OF TWO

const { onGameCreated, onGameStarted, onRecordReplay, onPlayerRemoved, onMove } = require("./replayHooks.js");

/**
 * @typedef Game
 * @type {{rows:number,cols:number,board:number[],teamboard:number[],state:number,index:number,players:import("ws").WebSocket[],rejoin_keys:string[],owned:number[],turn:number,move:number,inGame:number[],inGameAmount:number,connectedAmount:number,playerAmount:number,pub:boolean,ident:string,buffer:Buffer[],timestamp:number}}
 */

/**@type {Record<string, Game>} */
const games = {};
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
if (!fs.existsSync("replays")) {
    fs.mkdirSync("replays");
}
const _path = require("path");
if (!fs.existsSync("www/replays")) {
    fs.symlinkSync(_path.join(__dirname, "replays"), _path.join(__dirname, "www/replays"));
}
const http = require("http");
const crypto = require("crypto");
const url = require("url");
const settings = JSON.parse(fs.readFileSync(_path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
{
	const extend = (e, o) => {
		for (const key in o) {
			if (typeof o[key] === 'object') {
				if (key in e) {
					extend(e[key], o[key]);
				} else {
					extend(e, o[key]);
				}
			} else {
				e[key] = o[key];
			}
		}
	};
    const prefs = JSON.parse(fs.readFileSync(_path.join(__dirname, "prefs.json"), {encoding:"utf-8"}));
	extend(settings, prefs);
    // for (const pref in prefs) {
    //     settings[pref] = prefs[pref];
    // }
}
console.log(settings);
const wserv = new ws.Server({"port":settings.GAMEPORT});
const hserv = http.createServer((requ, resp) => {// TODO Check request target
    const reqpath = url.parse(requ.url).pathname;
    switch (reqpath) {
        case "/serverlist":
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
        default:
            resp.writeHead(400);
            resp.end();
            return;
    }
});
hserv.listen(settings.LISTPORT);
const minDim = 1;
const maxDim = 37;
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
 * "spec" - Whether the game is speculative
 *
 */
wserv.on("connection", (wsock, req) => {
	let params = null;
	try {
        const rurl = (new URL(`http://localhost${req.url}`));
		params = rurl.searchParams;
	} catch (et) {
		if(dbg) {
			console.log("URL object creation exception");
		}
		return;
	}
	let connType = getParamInt("t", 0, 3, 0, params);
	let requeWidth = getParamInt("w", minDim, maxDim, 6, params);
	let requeHeight = getParamInt("h", minDim, maxDim, 6, params);
	let requePlayers = getParamInt("p", 2, 10, 2, params);
	if (dbg) {
		console.log("Connection");
	}
	let gameID = "--------";
    /**@type {Game} */
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
                if (params.get("k")) {
                    if (params.get("k") === game.rejoin_keys[requePlayers]) {
                        // TODO
                    }
                }
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
            game.rejoin_keys.push(crypto.randomBytes(8).toString("base64url"));
            // wsock.send(`keydrejoin_${game.rejoin_keys[game.rejoin_keys.length-1]}`);
			game.connectedAmount++;
			game.inGame[playerNum] = 1;
			game.inGameAmount++;
			if (dbg) {
				console.log("Player assignment to game " + gameID);
			}
			wsock.send(`room${gameID}_${playerNum}`);
			wsock.send(`dims${game.rows}_${game.cols}`);
			if (playerNum == game.playerAmount) {
                // onGameStarted(game); // DO NOT PUSH
				// game.timestamp = Date.now();
				// console.log(game.timestamp);
				// game.buffer.push(Buffer.of(...nbytes(game.timestamp, 8), ...nbytes(game.cols, 2), ...nbytes(game.rows, 2), game.players.length-1, 0xf0, 0x0f));
				game.state = 1;
				game.turn = 1;
				game.move = -1;
				onGameStarted(game);
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
            // game.buffer.push(Buffer.from(gameID.split('').map(v => v.charCodeAt(0))));
			// game.buffer.push(Buffer.of((settings.REPLAYS.TIMESTAMP?(1<<7):0) | (0b01<<5))); // use timestamp from settings, use medium as it's the largest that doesn't use more bytes
			game.inGame[1] = 1;
			game.inGameAmount = 1;
			game.connectedAmount = 1;
			games[gameID] = game;
			game.ident = gameID;
            // onGameCreated(game, settings.REPLAYS.TIMESTAMP); // DO NOT PUSH
			game.players.push(wsock);
			onGameCreated(game, settings.REPLAYS.TIMESTAMP);
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
		/*
	    case"ping":
                const pingtype = "default";
                const pingdest = "active";
                const validtypes = ["default", "flash", "audio"];
                if (!validtypes.includes(pingtype)) return;
                const payload = `ping${playerNum},${pingtype}`;
                if (pingdest === "all") {
                    distrMess(payload, game);
                } else {
                    game.players[pingdest === "active" ? game.turn : pingdest].send(payload);
                }
                return;
		*/
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
				onMove(game, row, col, playerNum);
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
				let om = opponent(0, game, game.turn, 1);
				console.log(om);
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
 * @param {boolean} publi
 * @returns {Game}
 */
function genGame(width, height, player_amount, publi) {
	return {
		rows:height,
		cols:width,
		board:new Array(height * width).fill(1),
		teamboard:new Array(height * width).fill(0),
		state:0,
		players:[null],
        rejoin_keys:[null],
		owned:(new Array(player_amount + 1)).fill(height * width, 0, 1).fill(0, 1, player_amount + 1),
		inGame:(new Array(player_amount + 1)).fill(0, 0, player_amount + 1),
		inGameAmount: 0,
		connectedAmount: 0,
		playerAmount: player_amount,
		pub: publi,
		spec: 0
        // buffer: [Buffer.of(1)],
		// timestamp: 0
	};
}
function clonespec(game) {
	let gnew = Object.fromEntries(Object.entries(game));
	gnew.board = Array.from(gnew.board);
	gnew.teamboard = Array.from(gnew.teamboard);
	gnew.owned = Array.from(gnew.owned);
	gnew.inGame = Array.from(gnew.inGame);
	gnew.spec = 1;
	return gnew;
}
/**
 * @param {Game} game
 * @param {number} playerNum
 */
function removePlayer(game, playerNum) {
	// if (game.buffer[2] & (1<<7)) {
	// 	const ntime = Date.now();
	// 	const dtime = ntime - game.timestamp;
	// 	game.timestamp = ntime;
	// 	if (dtime > 65535) {
	// 		game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3), 0, 0, 0));
	// 	} else {
	// 		game.buffer.push(Buffer.of(0, ...toBytes(dtime)));
	// 		// game.buffer.push(Buffer.of(0, ...nbytes(dtime, 2)));
	// 	}
	// } else {
	// 	game.buffer.push(Buffer.of(0));
	// }
	// game.buffer.push(Buffer.of(playerNum));
    // onPlayerRemoved(game, playerNum); // DO NOT PUSH
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
	if (game.inGame[playerNum]) {
		game.inGame[playerNum] = 0;
		game.inGameAmount--;
		if (game.state == 1) {
			onPlayerRemoved(game, playerNum);
		}
	}
	if (game.turn != playerNum) {
		return;
	}
	if (!(game.inGameAmount)) {
		if (game.state == 1) {
			killGame(game);
		}
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
    // console.log(game.buffer);
	// game.buffer.push(Buffer.of(0xff, 0xf0, 0x0f, 0xff));
    // for (let i = 0; i < game.buffer.length; i ++) {
    //     if (typeof game.buffer[i] === "number") {
    //         console.log(`${i}: ${game.buffer[i]}\n${JSON.stringify(game.buffer[i-1])}\n${JSON.stringify(game.buffer[i+1])}`);
    //     }
    // }
    // if (settings.REPLAYS.ENABLED)fs.writeFileSync("replays/"+game.ident+".topl", Buffer.concat(game.buffer));
    // onRecordReplay(game); // DO NOT PUSH
	delete games[game.ident];
	let stol = game.state;
	game.state = 2;
	game.inGameAmount = 0;
	for (let i = Math.min(game.playerAmount, game.players.length - 1); i; i--) {
		if (game.players[i]) {
			game.inGameAmount++;
			game.inGame[i] = 1;
		}
	}
	if (stol == 1) {
		onRecordReplay(game, null);
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
/**
 * @param {number} rorig
 * @param {number} corig
 * @param {number} team
 * @param {import("./server").Game} game
 * @returns {boolean}
 */
function updateboard(rorig, corig, team, game) {
    // if (!dummy) game.buffer.push(...toBytes(rorig), ...toBytes(corig));
    // if (!dummy) {
	// 	if (game.buffer[2][0] & (1<<7)) {
	// 		const ntime = Date.now();
	// 		const dtime = ntime - game.timestamp;
	// 		game.timestamp = ntime;
	// 		if (dtime > 65535) {
	// 			game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3), 1, 0, 0));
	// 		} else {
	// 			game.buffer.push(Buffer.of(1, ...toBytes(dtime)));
	// 		}
	// 	} else {
	// 		game.buffer.push(Buffer.of(1));
	// 	}
	// 	game.buffer.push(Buffer.of(rorig&0xff, corig&0xff));
	// }
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
			let lt = game.teamboard[(row * cols) + col];
			game.owned[lt]--;
			game.teamboard[(row * cols) + col] = team;
			game.owned[team]++;
			if ((game.owned[lt] == 0) && (game.owned[0] == 0)) {
				if (lt) {
                    // if (!dummy) game.buffer.push(Buffer.of(0,0,0,lt));
					game.inGame[lt] = 0;
					game.inGameAmount--;
					if (!(game.spec)) {
						onPlayerRemoved(game, lt);
					}
				}
				else {
					for (let i = 1; i < game.owned.length; i++) {
						if (!(game.owned[i])) {
                            // if (!dummy) game.buffer.push(Buffer.of(0,0,0,i));
							game.inGame[i] = 0;
							game.inGameAmount--;
							if (!(game.spec)) {
								onPlayerRemoved(game, i);
							}
						}
					}
				}
			}
			if (game.owned[team] == tiles) {
				return true;
			}
		}
	}
	return false;
}
function opponent(mth, game, pln, npln) {
	let mxsc = (-1);
	let mxmm = 0;
	let mr = (-1);
	let mc = (-1);
	let rows = game.rows;
	let cols = game.cols;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < rows; col++) {
			let score = 0;
			ngame = clonespec(game);

			if (ngame.teamboard[(row * cols) + col] && (ngame.teamboard[(row * cols) + col] != pln)) {
				score = (-1);
			}
			else {
				if (updateboard(row, col, pln, ngame)) {
					score = (-2);
				}
				else {
					score = ngame.owned[pln];
				}
			}
			
			console.log(`${col},${row}: ${score}`);
			if (score == (-2)) {
				mxsc = score;
				mxmm = 1;
				mr = row;
				mc = col;
				break;
			}
			if (score > mxsc) {
				mxsc = score;
				mr = row;
				mc = col;
			}
		}
		if (mxmm) {
			break;
		}
	}
	if (mxsc == (-1)) {
		return 0;
	}
	return [mr, mc];
}
