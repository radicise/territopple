{
    const tmp = document.body.children[0].clientLeft+document.body.children[0].clientWidth;
    document.body.style.setProperty("--banner-min-left", (window.innerWidth - tmp)/2 + tmp);
    window.addEventListener("resize", () => {
        // document.body.style.setProperty("--banner-min-left", document.body.children[0].clientLeft+document.body.children[0].clientWidth);
        const tmp = document.body.children[0].clientLeft+document.body.children[0].clientWidth;
    document.body.style.setProperty("--banner-min-left", (window.innerWidth - tmp)/2 + tmp);
    });
}

var dbg = 1;
// let symbs = ["!", "-", "+", "W", "&block;"];
// let teamcols = ["#000000", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];
let queries = new URLSearchParams(window.location.search);

let lastMoveId = null;

const displaySettings = {
    "highlightLastMove": true
};
const displaySettingMonitors = {
    "highlightLastMove": (o, n) => {
        if (o === n) return; // no change, don't do anything
        if (n) {
            document.getElementById(lastMoveId)?.classList.add("last-move");
        } else {
            document.querySelector(".last-move")?.classList.remove("last-move");
        }
    },
};
// replaces the settings with properties that have specified getter/setter functions
for (const name in displaySettings) {
    const newname = "_"+name; // backing property name
    Object.defineProperty(displaySettings, newname, {writable:true,enumerable:false,value:displaySettings[name]}); // new name should not show up in enumeration
    delete displaySettings[name]; // delete old name
    Object.defineProperty(displaySettings, name, {get:()=>displaySettings[newname],set:(v)=>{displaySettingMonitors[name]?.call(displaySettingMonitors[name], displaySettings[newname], v);displaySettings[newname]=v;},enumerable:true}); // redefine old name
}

const queueAnimation = (()=>{
    const queues = {};
    function deque(elem){
        if (queues[elem].length === 0) {
            delete queues[elem];
            return;
        }
        const className = queues[elem][0][0];
        const props = queues[elem][0][1];
        const tempProps = queues[elem][0][2] || [];
        queues[elem].splice(0, 1);
        for (const prop in props) {
            elem.style.setProperty(prop, props[prop]);
        }
        elem.onanimationend = () => {
            elem.onanimationend = null;
            elem.classList.remove(className);
            for (const prop of tempProps) {
                elem.style.removeProperty(prop);
            }
            setTimeout(()=>{deque(elem);}, 0);
        };
        elem.classList.add(className);
    };
    return (
    /**
     * @param {HTMLElement} elem
     * @param {string} className
     * @param {object} props
     * @param {string[]} tempProps
     */
    (elem, className, props, tempProps) => {
        if (!(elem in queues)) {
            queues[elem] = [];
        }
        queues[elem].push([className, props, tempProps]);
        if (!elem.onanimationend) {
            deque(elem);
        }
    }
)})();

let t = parseInt(queries.get("t") ?? "0") || 0;
let rows = parseInt(queries.get("h") ?? "6") || 6;
let cols = parseInt(queries.get("w") ?? "6") || 6;
let players = parseInt(queries.get("p") ?? "2") || 2;
let port = parseInt(queries.get("port") ?? "8300");
if (isNaN(port)) {
	port = 8300;
}
let host = document.location.hostname;

const render3d = document.getElementById("feature-3d")?.nodeName === "META";
if (render3d) {
    const s = document.createElement("script");
    s.src = "render3.js";
    s.type = "module";
    document.body.appendChild(s);
}

if (rows < 1 || rows >= 37 || cols < 1 || cols >= 37) {
	rows = 5;
	cols = 5;
}

if (players < 2 || players > 10) {
	players = 2;
}

let serv = null;
let gameid = "--------";
if (t !== 0) {
    serv = `ws://${host}:${port}/?t=${t}&h=${rows}&w=${cols}&p=${players}`;
} else {
    let gameid = queries.get("g") ?? "g";
    serv = `ws://${host}:${port}/?t=0&g=${gameid}`;
}

let board = new Array(cols * rows);
let boardold = new Array(cols * rows);
let teamboard = new Array(cols * rows);
let teamboardold = new Array(cols * rows);
let ifmt = {};
ifmt.pln = 0;
ifmt.room = null;
ifmt.turn = 0;
ifmt.team = 0;

/**@type {Game} */
let game = new Game();

// display("Connecting . . .");
createBanner({type:"info",content:"Connecting . . ."});
if (dbg) {
	console.log(serv);
}
let conn = new WebSocket(serv);
conn.addEventListener("open", function(event) {
    document.getElementById("pingbutton").addEventListener("click", () => {
        if (ifmt.turn === 0) return;
        // conn.send(`ping`);
    });
    document.getElementById("startbutton").addEventListener("click", () => {
        if (!game.started && game.hostNum === ifmt.pln) {
            conn.send(JSON.stringify({type:"waiting:start",payload:{}}));
        }
    });
	// display("Connected");
    createBanner({type:"info",content:"Connected"});
	conn.addEventListener("message", function(event) {
        /**@type {{type:string,payload:Record<string,any>}} */
        const data = JSON.parse(event.data);
        switch (data.type) {
            case "waiting:promote":{
                game.hostNum = data.payload["n"];
                document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                break;
            }
            case "waiting:start":{
                game.started = true;
                break;
            }
            case "waiting:kick":{
                break;
            }
            case "error":{
                createBanner({type:"error", fade:false, content:`${data.payload["message"]??data.payload["code"]}`});
                break;
            }
            case "key:rejoin":{
                break;
            }
            case "player:join":{
                game.joinedPlayers ++;
                game.playerList[data.payload["n"]] = {team:data.payload["t"]};
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
				break;
            }
            case "player:leave":{
                game.joinedPlayers --;
                game.playerList[data.payload["n"]] = null;
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
				break;
            }
            case "player:spectate":{}
            case "player:ownid":{
                ifmt.pln = data.payload["n"];
                ifmt.team = data.payload["t"];
                document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                if (ifmt.room) {
                    updScr("info", `Room ${game.ident}, Player ${ifmt.pln}`);
                }
                break;
            }
            case "spectator:join":{
                break;
            }
            case "spectator:leave":{
                break;
            }
            case "spectator:ownid":{
                break;
            }
            case "game:roomid":{
                ifmt.room = data.payload["g"];
                game.ident = data.payload["g"];
                if (ifmt.pln) {
                    updScr("info", `Room ${game.ident}, Player ${ifmt.pln}`);
                }
                break;
            }
            case "game:config":{
                // rows = mesr;
                // cols = mess;
                rows = data.payload["h"];
                cols = data.payload["w"];
                players = data.payload["p"];
                game.hostNum = data.payload["l"];
                document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                document.getElementById("gameboard").style.cssText = `--ncols:${cols};--nrows:${rows};`;
                // board = new Array(cols * rows).fill(1);
                // boardold = new Array(cols * rows).fill(1);
                // teamboard = new Array(cols * rows).fill(0);
                // teamboardold = new Array(cols * rows).fill(0);
                ifmt.turn = 0;
                game.setConfig(cols, rows, players);
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                createBoard(rows, cols, game.board, game.teamboard);
                document.getElementById("board-rendering-option").onchange = () => {
                    createBoard(rows, cols, game.board, game.teamboard, Number(document.getElementById("board-rendering-option").value)-1);
                };
                break;
            }
            case "game:turn":{
                ifmt.turn = data.payload["n"];
                updScr("status", `Player ${data.payload["n"]}'s turn`);
                // if (mess < 0) {
                // }
                // else {
                //     let rmo = Math.floor(mess / cols);
                //     mess = mess % cols;
                //     updScr("status", "Player " + mesr.toString() + "\'s turn, last move was " + mess.toString() + "x" + rmo.toString());
                // }
                break;
            }
            case "game:move":{
                const n = data.payload["n"];
                const col = n % cols;
                const row = (n-col)/cols;
                console.log(rows, cols, n, data);
                const tmu = data.payload["t"];
                game.move(n, tmu);
                // updateboard(row, col, tmu);
                lastMoveId = `r${row}c${col}`;
                if (displaySettings.highlightLastMove) {
                    document.querySelector(".last-move")?.classList.remove("last-move");
                    document.getElementById(lastMoveId).classList.add("last-move");
                }
				break;
            }
            case "game:win":{
                ifmt.turn = 0;
                {
                    // let rmo = Math.floor(mess / cols);
                    // mess = mess % cols;
                    updScr("status", `Team ${data.payload['t']} won the game`);
                    displaySettings.highlightLastMove = false;
                    container.parentElement.style.setProperty("--blink-dark", teamcols[mesr]+"88");
                    container.parentElement.classList.add("blink2");
                }
                {
                    /**@type {HTMLDivElement} */
                    const da = document.getElementById("download-area");
                    /**@type {HTMLInputElement} */
                    const db = da.firstElementChild;
                    /**@type {HTMLAnchorElement} */
                    const dl = da.lastElementChild;
                    db.onclick = ()=>{dl.click();db.onclick = undefined;};
                    dl.href = `/replays/${ifmt.room}.topl`;
                    dl.download = `${ifmt.room}.topl`;
                    da.hidden = false;
                }
                break;
            }
        }
        return;
		var type = event.data.substring(0,4);
		var mess = event.data.substring(4);
		switch (type) {
            case "ping":
                const orig = mess.split(",")[0];
                const kind = mess.split(",")[1].replace("default", "flash");
                switch (kind) {
                    case "flash":
                        if (ifmt.turn) {
                            queueAnimation(container, "blink", {"--blink-dark":"#ddd","--blink-dur":"0.25s"}, ["--blink-dur"]);
                        }
                        break;
                }
                break;
			case ("disc"):// ex. gr. disc
				conn.close();
				mess = sanint(mess);
				// display("Disconnected by server for reason number " + mess.toString());
                createBanner({type:"error",fade:false,content:`Disconnected by server. Error ${mess}`});
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
                lastMoveId = `r${row}c${col}`;
                if (displaySettings.highlightLastMove) {
                    document.querySelector(".last-move")?.classList.remove("last-move");
                    document.getElementById(lastMoveId).classList.add("last-move");
                }
				break;
			case ("room"):// ex. gr. roomAWNW8W9D_2
			case ("plyw"):// ex. gr. plyw2_3
			case ("turn"):// ex. gr. turn2_23
			case ("wnnr"):// ex. gr. wnnr2_0
			case ("dims"):// ex. gr. dims6_8
				mess = mess.split("_");
				if (mess.length != 2) {
					recvInval(9);
				}
				let mesr = mess[0];
				if (type == "room") {
					let mea = mesr.split("");
					if (mea.length != 8) {
						recvInval(11);
					}
					for (let i = 0; i < 8; i++) {
						let j = mea[i].charCodeAt(0);
						if ((j < 52) || (j >= 91) || ((j >= 58) && (j < 65))) {
							recvInval(12);
						}
					}
				} else {
					mesr = sanint(mesr);
				}
				mess = sanint(mess[1]);
				switch (type) {
					case ("room"):
						ifmt.room = mesr;
						ifmt.pln = mess;
						updScr("info", "Room " + mesr + ", Player " + mess.toString());
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
                            displaySettings.highlightLastMove = false;
                            container.parentElement.style.setProperty("--blink-dark", teamcols[mesr]+"88");
                            container.parentElement.classList.add("blink2");
						}
                        {
                            /**@type {HTMLDivElement} */
                            const da = document.getElementById("download-area");
                            /**@type {HTMLInputElement} */
                            const db = da.firstElementChild;
                            /**@type {HTMLAnchorElement} */
                            const dl = da.lastElementChild;
                            db.onclick = ()=>{dl.click();db.onclick = undefined;};
                            dl.href = `/replays/${ifmt.room}.topl`;
                            dl.download = `${ifmt.room}.topl`;
                            da.hidden = false;
                        }
						break;
					case ("dims"):
						rows = mesr;
						cols = mess;
						document.getElementById("gameboard").style.cssText = `--ncols:${cols};--nrows:${rows};`;
						board = new Array(cols * rows);
						boardold = new Array(cols * rows);
						teamboard = new Array(cols * rows);
						teamboardold = new Array(cols * rows);
						ifmt.turn = 0;
						for (let i = (cols * rows) - 1; i >= 0; i--) {
							board[i] = 1;
							boardold[i] = 1;
							teamboard[i] = 0;
							teamboardold[i] = 0;
						}
                        createBoard(rows, cols, board, teamboard);
                        document.getElementById("board-rendering-option").onchange = () => {
                            createBoard(rows, cols, board, teamboard, Number(document.getElementById("board-rendering-option").value)-1);
                        };
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
	document.getElementById("gameboard").addEventListener("mouseup", function(event) {
        if (document.getElementById("gameboard").style.getPropertyValue("--disabled") === "1") {
            return;
        }
		if (dbg) {
			console.log("Click on board");
		}
        if (!game.started) return;
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
		if ((game.teamboard[mes]) && (game.teamboard[mes] != ifmt.pln)) {
			return;
		}
		// conn.send("move" + d);
        conn.send(JSON.stringify({type:"game:move",payload:{n:mes}}));
		return;
	});
	return;
});
function recvInval(valstr) {
	// display("Invalid data received from server, error " + valstr);
    createBanner({type:"error", fade:false, content:`Invalid data received from server, error ${valstr}`});
	return;
}// TODO Disconnect from server
// TODO: Upon disconnection from server
function sanint(valstr) {
	let n = parseInt(valstr);
	if (isNaN(n)) {
		recvInval("7");
        throw new Error("// TODO Actually crash, maybe redirect to a page?");
		// while (1) {
		// }// TODO Actually crash, maybe redirect to a page?
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
                    if (dbg) {
                        console.log("Change of state of tile at r" + row.toString() + "c" + col.toString());
                    }
                    updateTile(row, col, team, board[ct]);
                }
                ct--;
            }
        }
        for (let r = 0; r < rows; r ++) {
            for (let c = 0; c < cols; c ++) {
                let nm = 4;
                if ((c == 0) || (c == (cols - 1))) {
                    nm--;
                }
                if ((r == 0) || (r == (rows - 1))) {
                    nm--;
                }
                setVolatile(r, c, board[r*cols + c] === nm);
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
