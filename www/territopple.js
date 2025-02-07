var dbg = 1;
let symbs = ["!", "-", "+", "W", "&block;"];
let teamcols = ["#000000", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];
let queries = new URLSearchParams(window.location.search);
let rows = queries.get("h") ?? "5";
let cols = queries.get("w") ?? "5";
let port = queries.get("p") ?? "8301";
let host = document.location.hostname;

const render3d = document.getElementById("feature-3d")?.nodeName === "META";
if (render3d) {
    const s = document.createElement("script");
    s.src = "render3.js";
    s.type = "module";
    document.body.appendChild(s);
}

rows = parseInt(rows);
cols = parseInt(cols);
port = parseInt(port);
if ((isNaN(rows) || isNaN(cols)) || (((rows < 1) || (rows >= 37)) || ((cols < 1) || (cols >= 37)))) {
	rows = 5;
	cols = 5;
}
document.getElementById("gameboard").style.cssText = `--ncols:${cols};--nrows:${rows};`;

if (isNaN(port)) {
	port = 8301;
}

let serv = `ws://${host}:${port}/?t=1`;

let board = "";
for (let i = 0; i < rows; i++) {
	for (let j = 0; j < cols; j++) {
		board = board.concat("<div id=\"r" + i.toString() + "c" + j.toString() + "\">-</div>");
	}
}
document.getElementById("gameboard").innerHTML = board;
board = new Array(cols * rows);
let boardold = new Array(cols * rows);
let teamboard = new Array(cols * rows);
let teamboardold = new Array(cols * rows);
let ifmt = {};
ifmt.pln = 0;
ifmt.room = 0;
ifmt.turn = 0;
for (let i = (cols * rows) - 1; i >= 0; i--) {
	board[i] = 1;
	boardold[i] = 1;
	teamboard[i] = 0;
	teamboardold[i] = 0;
}
display("Connecting . . .");
if (dbg) {
	console.log(serv);
}
let conn = new WebSocket(serv);
conn.addEventListener("open", function(event) {
	display("Connected");
	conn.addEventListener("message", function(event) {
		var type = event.data.substring(0,4);
		var mess = event.data.substring(4);
		switch (type) {
			case ("disc"):// ex. gr. disc
				conn.close();
				mess = sanint(mess);
				display("Disconnected by server for reason number " + mess.toString());
				break;
			case ("updt"):// ex. gr. updtr0c0_1_1;r0c1_1_2;
				let lst = 0;
				while (1) {
					let nxt = mess.indexof(";", lst + 1);
					if (nxt == (-1)) {
						break;
					}
					let dat = mess.substring(lst + 1, nxt);
					let dspl = dat.split("_");
					let ident = dspl[0];
					let val = dspl[1];
					let tm = dspl[2];
					if (ident.split(0, 1) != "r") {
						recvInval("2");
						lst = nxt;
						continue;
					}
					dat = sanint(val);
					if ((dat < 1) || (dat >= 5)) {
						recvInval("4");
						lst = nxt;
						continue;
					}
					let symb = symbs[dat];
					dat = sanint(tm);
					if ((dat < 0) || (dat >= teamcol.length)) {
						recvInval("6");
						lst = nxt;
						continue;
					}
					let tcol = teamcols[dat];
					dat = document.getElementById(ident);
					if (dat === null) {
						lst = nxt;
						continue;
					}
					dat.style.color = tcol;
					dat.innerHTML = symb;
					lst = nxt;
				}// TODO Adjust board and teamboard
				break;
			case ("pcmt"):// ex. gr. pcmtr0c0_1
				if (dbg) {
					console.log("Player move reception from server");
				}
				let tmu = mess.split("_");
				mess = tmu[0];
				tmu = sanint(tmu[1]);
				if ((tmu < 0) || (tmu >= teamcols.length)) {
					break;
				}
				mess = mess.substring(1);
				mess = mess.split("c");
				if (mess.length != 2) {
					break;
				}
				let col = sanint(mess[1]);
				let row = sanint(mess[0]);
				if (((col < 0) || (col >= cols)) || ((row < 0) || (row >= rows))) {
					break;
				}
				updateboard(row, col, tmu);
				break;
			case ("room"):// ex. gr. room3_2
			case ("plyw"):// ex. gr. plyw2_3
			case ("turn"):// ex. gr. turn2_23
			case ("wnnr"):// ex. gr. wnnr2_0
				mess = mess.split("_");
				if (mess.length != 2) {
					recvInval(9);
				}
				let mesr = sanint(mess[0]);
				mess = sanint(mess[1]);
				switch (type) {
					case ("room"):
						ifmt.room = mesr;
						ifmt.pln = mess;
						updScr("info", "Room " + mesr.toString() + ", Player " + mess.toString());
						break;
					case ("plyw"):
						updScr("status", mesr.toString() + " player(s) present in room, " + mess.toString() + " needed to start");
						break;
					case ("turn"):
						ifmt.turn = mesr;
						if (mess < 0) {
							updScr("status", "Player " + mesr.toString() + "\'s turn");
						}
						else {
							let rmo = Math.floor(mess / cols);
							mess = mess % cols;
							updScr("status", "Player " + mesr.toString() + "\'s turn, last move was " + mess.toString() + "x" + rmo.toString());
						}
						break;
					case ("wnnr"):
						ifmt.turn = 0;
						{
							let rmo = Math.floor(mess / cols);
							mess = mess % cols;
							updScr("status", "Player " + mesr.toString() + " won the game with move " + mess.toString() + "x" + rmo.toString());
						}
						break;
					default:// This should be impossible
						recvInval("10");
						break;
				}
				break;
			default:
				recvInval("1");
				break;
		}
		return;
	});
	document.getElementById("gameboard").addEventListener("mousedown", function(event) {
		if (dbg) {
			console.log("Click on board");
		}
		if (!(ifmt.turn)) {
			return;
		}
		if (ifmt.turn != ifmt.pln) {
			return;
		}
		let d = event.target.id;
		if (d.substring(0, 1) != "r") {
			return;
		}
		if (dbg) {
			console.log("Click on space on board");
		}
		let mes = d.substring(1);
		mes = mes.split("c");
		if (mes.length != 2) {
			return;
		}
		let meg = parseInt(mes[1]);
		mes = parseInt(mes[0]);
		if (isNaN(mes) || isNaN(meg)) {
			return;
		}
		mes = (mes * cols) + meg;
		if ((teamboard[mes]) && (teamboard[mes] != ifmt.pln)) {
			return;
		}
		conn.send("move" + d);
		return;
	});
	return;
});
function recvInval(valstr) {
	display("Invalid data received from server, error " + valstr);
	return;
}// TODO Disconnect from server
// TODO: Upon disconnection from server
function sanint(valstr) {
	let n = parseInt(valstr);
	if (isNaN(n)) {
		recvInval("7");
		while (1) {
		}// TODO Actually crash, maybe redirect to a page?
	}
	return n;
}
function display(text) {
	console.log(text);
	return;
}
function updateboard(rorig, corig, team) {
	let adds = [corig, rorig];
	while (adds.length) {
		let row = adds.pop();
		let col = adds.pop();
		let nv = ++board[(row * cols) + col];
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
		teamboard[(row * cols) + col] = team;
	}
    if (render3d) {
        window.dispatchEvent(new Customevent("board-update", {board,teamboard,boardold,teamboardold}));
    } else {
        let ct = (cols * rows) - 1;
        for (let row = rows - 1; row >= 0; row--) {
            for (let col = cols - 1; col >= 0; col--) {
                if ((boardold[ct] != board[ct]) || (teamboardold[ct] != teamboard[ct])) {
                    let dat = document.getElementById("r" + row.toString() + "c" + col.toString());
                    if (dbg) {
                        console.log("Change of state of tile at r" + row.toString() + "c" + col.toString());
                    }
                    dat.style.color = teamcols[team];
                    dat.innerHTML = symbs[board[ct]];
                }
                ct--;
            }
        }
    }
	for (let i = (cols * rows) - 1; i >= 0; i--) {
		boardold[i] = board[i];
		teamboardold[i] = teamboard[i];
	}
	return;
}
function updScr(elemid, valstr) {
	document.getElementById(elemid).innerHTML = valstr;
}
