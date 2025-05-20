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
let dims = queries.get("d");
let players = parseInt(queries.get("p") ?? "2") || 2;
let port = parseInt(queries.get("port") ?? "noport");
if (isNaN(port)) {
	// port = 8300;
    port = null;
}
// let host = document.location.hostname + ":" + game_port.toString();
let host = document.location.hostname + "/ws";

if (document.getElementById("feature-3d")?.nodeName === "META") {
    window.alert("WARNING! Arbitrary code execution is ENABLED. If you are not a developer, immediately contact the server operator");
}

function rexec(s) {
    window.postMessage({type:"3d-exec",s:s});
}
// const render3d = document.getElementById("feature-3d")?.nodeName === "META";
// if (render3d) {
//     const s = document.createElement("script");
//     s.src = "render3.js";
//     s.type = "module";
//     document.body.appendChild(s);
// }

// if (rows < 1 || rows >= 37 || cols < 1 || cols >= 37) {
// 	rows = 5;
// 	cols = 5;
// }

if (players < 2 || players > 10) {
	players = 2;
}

let serv = null;
let gameid = "--------";
if (sessionStorage.getItem("rejoin_key") !== null) {
    gameid = sessionStorage.getItem("rejoin_g");
    let pn = sessionStorage.getItem("rejoin_p");
    let rkey = sessionStorage.getItem("rejoin_key");
    serv = `ws://${host}/?t=3&g=${gameid}&i=${pn}&k=${rkey}`;
} else {
    if (t > 0 && t < 3) {
        const allow_spectators = queries.get("s") ?? "1";
        serv = `ws://${host}/?t=${t}&s=${allow_spectators}&d=${dims}&p=${players}`;
    } else {
        gameid = queries.get("g") ?? "g";
        serv = `ws://${host}/?t=${t}&g=${gameid}`;
    }
}

// let board = new Array(cols * rows);
// let boardold = new Array(cols * rows);
// let teamboard = new Array(cols * rows);
// let teamboardold = new Array(cols * rows);
let ifmt = {};
ifmt.pln = 0;
ifmt.room = null;
ifmt.turn = 0;
ifmt.team = 0;

/**@type {import("./logic/game.js").Game} */
let game = new Game();

// display("Connecting . . .");
createBanner({type:"info",content:"Connecting . . ."});
if (dbg) {
	console.log(serv);
}
let conn = new WebSocket(serv);

/**
 * @param {number} pNum
 */
function kickPlayer(pNum) {
    if (ifmt.pln !== game.hostNum) return; // can only kick if host
    if (ifmt.pln === pNum) return; // can't kick self
    if (!game.playerList[pNum]) return; // player doesn't exist
    conn.send(JSON.stringify({type:"waiting:kick",payload:{n:pNum}}));
}
/**
 * @param {string} sId
 */
function kickSpectator(sId) {
    if (ifmt.pln !== game.hostNum) return; // can only kick if host
    conn.send(JSON.stringify({type:"waiting:kick",payload:{n:sId}}));
}
/**
 * @param {number} pNum
 */
function promotePlayer(pNum) {
    if (ifmt.pln !== game.hostNum) return; // can only promote if host
    if (ifmt.pln === pNum) return; // can't promote self
    if (!game.playerList[pNum]) return; // player doesn't exist
    conn.send(JSON.stringify({type:"waiting:promote",payload:{n:pNum}}));
}
function rescanHostOnly() {
    const dis = !(game.hostNum === ifmt.pln);
    document.querySelectorAll("input.FLAG-host-only").forEach(v => v.disabled = dis);
}

// updateTile(0, 0, 1, 1);
// updateTile(0, 2, 2, 2);
// updateTile(0, 3, 3, 2);
// updateTile(0, 4, 4, 1);
// updateTile(0, 5, 5, 2);
// flushUpdates();

// let nonstrdata = null;

// /**@type {HTMLInputElement} */
// const readyButton = document.getElementById("readybutton");
// let amready = false;
conn.addEventListener("open", async function(event) {
    // readyButton.addEventListener("click", () => {
    //     if (game.started) return;
    //     amready = !amready;
    //     readyButton.value = amready ? "unready" : "ready";
    //     conn.send(JSON.stringify({type:"waiting:setready",payload:{r:amready}}));
    // });
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
    let configed = false;
	conn.addEventListener("message", async function(event) {
        if (typeof event.data !== "string") {
            // console.log(event.data);
            // nonstrdata = event.data;
            /**@type {Blob} */
            const dat = event.data;
            // dat.arrayBuffer().then((v) => {
            // })
            dat.arrayBuffer().then(async (v) => {
                if (!configed) {
                    await new Promise(r => {configed = r;});
                }
                const arr = new Uint8Array(v);
                let bypos = 1;
                let bipos = 0;
                const consumebits = (n) => {
                    if (bipos === 8) {
                        bypos ++;
                        bipos = 0;
                    }
                    if (bipos + n > 8) {
                        const rem = 8 - bipos;
                        const oth = n - rem;
                        return (consumebits(rem)<<oth)|consumebits(oth);
                    }
                    // const r = (arr[bypos]>>(7-bipos))&(0xff>>(8-n));
                    // const r = (arr[bypos]>>(0xff>>bipos))&(0xff>>(8-n));
                    const r = (arr[bypos]>>(8-bipos-n))&(0xff>>(8-n));
                    bipos += n;
                    return r;
                };
                const kind = arr[0];
                switch (kind) {
                    case 0:{
                        const bb = game.board;
                        const tb = game.teamboard;
                        const oldb = Array.from(bb);
                        const oldt = Array.from(tb);
                        const bleft = game.rows * (game.cols - 1) - 1;
                        const bright = bb.length - 1;
                        for (let i = 0; i < bb.length; i ++) {
                            game.board[i] = consumebits(game.topology.getRequiredBits(i)) + 1;
                            // if (i === 0 || i === game.cols-1 || i === bleft || i === bright) {
                            //     game.board[i] = consumebits(1) + 1;
                            //     console.log(`${i}: ${game.board[i]}`);
                            // } else {
                            //     game.board[i] = consumebits(2) + 1;
                            // }
                        }
                        let i = 0;
                        while (i < tb.length) {
                            if (consumebits(1) === 0) {
                                tb[i] = consumebits(3);
                                i ++;
                                continue;
                            } else {
                                const t = consumebits(3);
                                const c = consumebits(4)+1;
                                for (let j = 0; j < c; j ++) {
                                    tb[i+j] = t;
                                }
                                i += c;
                            }
                        }
                        game.recalcDerived();
                        game.updateBoard(oldb, oldt);
                        break;
                    }
                }
            });
            return;
        }
        /**@type {{type:string,payload:Record<string,any>}} */
        const data = JSON.parse(event.data);
        // console.log(data.type);
        switch (data.type) {
            // case "waiting:setready":{
            //     game.playerList[data.payload["n"]]?.ready = data.payload["r"];
            //     //
            //     break;
            // }
            case "waiting:promote":{
                if (game.hostNum) {
                    const c = document.getElementById(`JLIST-player-${game.hostNum}`);
                    if (c) {
                        c.children[1].textContent = "Player";
                    }
                }
                game.hostNum = data.payload["n"];
                const c = document.getElementById(`JLIST-player-${game.hostNum}`);
                if (c) {
                    c.children[1].textContent = "Host";
                }
                // document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                createBanner({type:"info",content:`Player ${game.hostNum} was promoted to host`});
                rescanHostOnly();
                break;
            }
            case "waiting:start":{
                game.started = true;
                createBanner({type:"info",content:`Game started`});
                break;
            }
            case "waiting:kick":{
                let n = data.payload["n"];
                if (typeof n === "number") {
                    if (ifmt.pln === n) {
                        createBanner({type:"info",fade:false,content:"You were kicked"});
                        conn.close();
                        return;
                    }
                    createBanner({type:"info",content:`Player ${n} kicked`});
                    removeJListPlayer(n);
                    game.joinedPlayers --;
                    game.playerList[n] = null;
                    updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                } else {
                    if (ifmt.team === -1) {
                        if (n === ifmt.pln) {
                            createBanner({type:"info",content:"You were kicked"});
                            conn.close();
                            return;
                        }
                    }
                    createBanner({type:"info",content:`Spectator ${n} kicked`});
                    removeJListSpectator(n);
                }
                break;
            }
            case "error":{
                if (data.payload["store"]) {
                    sessionStorage.setItem("error-store", data.payload["store"]);
                }
                if (data.payload["redirect"]) {
                    window.location.href = data.payload["redirect"];
                }
                createBanner({type:"error", fade:false, content:`${data.payload["message"]??data.payload["code"]}`});
                break;
            }
            case "key:rejoin":{
                sessionStorage.setItem("rejoin_key", data.payload["key"]);
                sessionStorage.setItem("rejoin_g", data.payload["g"]);
                sessionStorage.setItem("rejoin_p", data.payload["p"]);
                break;
            }
            case "player:join":{
                game.joinedPlayers ++;
                game.playerList[data.payload["n"]] = {team:data.payload["t"],time:((game.rules?.turnTime?.limit||0)/1000)||null};
                createBanner({type:"info",content:`Player ${data.payload['n']} has joined`});
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                if (ifmt.pln !== data.payload["n"]) addJListPlayer(data.payload["n"]);
                if (game.rules?.turnTime?.style === "chess") {
                    setJListTime(data.payload["n"], game.playerList[data.payload["n"]].time);
                }
				break;
            }
            case "player:leave":{
                game.joinedPlayers --;
                game.playerList[data.payload["n"]] = null;
                createBanner({type:"info",content:`Player ${data.payload['n']} has left`});
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                removeJListPlayer(data.payload["n"]);
				break;
            }
            case "player:lose":{
                game.losePlayer(data.payload["n"]);
                break;
            }
            case "player:spectate":{
                break;
            }
            case "player:ownid":{
                ifmt.pln = data.payload["n"];
                ifmt.team = data.payload["t"];
                game.joinedPlayers ++;
                game.playerList[data.payload["n"]] = {team:data.payload["t"],time:((game.rules?.turnTime?.limit||0)/1000)||null};
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                // document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                rescanHostOnly();
                removeJListPlayer(ifmt.pln);
                addJListSelf(ifmt.pln);
                if (ifmt.room) {
                    updScr("info", `Room ${game.ident}, Player ${ifmt.pln}`);
                }
                break;
            }
            case "spectator:join":{
                addJListSpectator(data.payload["n"]);
                createBanner({type:"info",content:`Spectator ${data.payload['n']} has joined`});
                break;
            }
            case "spectator:leave":{
                createBanner({type:"info",content:`Spectator ${data.payload['n']} has left`});
                removeJListSpectator(data.payload["n"]);
                break;
            }
            case "spectator:ownid":{
                ifmt.pln = data.payload["n"];
                ifmt.team = -1;
                addJListSelf(data.payload["n"]);
                if (ifmt.room) {
                    updScr("info", `Room ${game.ident}, Spectator ${ifmt.pln}`);
                }
                break;
            }
            case "game:roomid":{
                ifmt.room = data.payload["g"];
                game.ident = data.payload["g"];
                if (ifmt.pln) {
                    if (ifmt.team === -1) {
                        updScr("info", `Room ${game.ident}, Spectator ${ifmt.pln}`);
                    } else {
                        updScr("info", `Room ${game.ident}, Player ${ifmt.pln}`);
                    }
                }
                {
                    const rstr = sessionStorage.getItem("game_rules");
                    console.log(JSON.parse(rstr));
                    sessionStorage.removeItem("game_rules");
                    if (rstr) conn.send(`{"type":"game:rules","payload":${rstr}}`);
                    else conn.send("{\"type\":\"game:rules\",\"payload\":{}}");
                }
                break;
            }
            case "game:config":{
                // rows = mesr;
                // cols = mess;
                // rows = data.payload["h"];
                // cols = data.payload["w"];
                const tilecount = data.payload["c"];
                const dims = data.payload["d"];
                const topid = data.payload["t"];
                dims.type = topid;
                // console.log(dims);
                //// TOPOLOGY CONFIG POINT ////
                if (topid < 4) {
                    rows = tilecount/dims.x;
                    cols = dims.x;
                } else {
                    throw new Error("unknown topology");
                }
                players = data.payload["p"];
                game.hostNum = data.payload["l"];
                const c = document.getElementById(`JLIST-player-${game.hostNum}`);
                if (c) {
                    c.children[1].textContent = "Host";
                }
                // document.getElementById("startbutton").disabled = !(game.hostNum === ifmt.pln);
                rescanHostOnly();
                document.getElementById("gameboard").style.cssText = `--ncols:${cols};--nrows:${rows};`;
                ifmt.turn = 0;
                // await game.setConfig(topology.m.formatDimensions(dims), players);
                await game.setConfig(dims, players);
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                if (configed) {
                    configed();
                }
                configed = true;
                break;
            }
            case "game:jlist":{
                /**@type {[number, number][]} */
                const pl = data.payload["p"];
                /**@type {string[]} */
                const sl = data.payload["s"];
                for (const p of pl) {
                    if (ifmt.pln) {
                        if (p[0] === ifmt.pln) continue;
                    }
                    game.joinedPlayers ++;
                    game.playerList[p[0]] = {team:p[1]};
                    addJListPlayer(p[0]);
                }
                for (const s of sl) {
                    addJListSpectator(s);
                }
                updScr("status", `${game.joinedPlayers} player(s) present in room, ${game.maxPlayers} players max`);
                break;
            }
            case "game:reconnected":{
                game.started = true;
                break;
            }
            case "game:turn":{
                ifmt.turn = data.payload["n"];
                updScr("status", `Player ${data.payload["n"]}'s turn`);
                if (game.rules?.turnTime?.limit && data.payload["t"]) {
                    game.runTimer(data.payload['n']);
                }
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
                // console.log(rows, cols, n, data);
                const tmu = data.payload["t"];
                game.move(n, tmu);
                // updateboard(row, col, tmu);
                lastMoveId = `r${row}c${col}`;
                if (displaySettings.highlightLastMove) {
                    document.querySelector(".last-move")?.classList.remove("last-move");
                    document.getElementById(lastMoveId)?.classList.add("last-move");
                }
				break;
            }
            case "game:win":{
                ifmt.turn = 0;
                game.stopTimer();
                {
                    // let rmo = Math.floor(mess / cols);
                    // mess = mess % cols;
                    updScr("status", `Team ${data.payload['t']} won the game`);
                    displaySettings.highlightLastMove = false;
                    // container.parentElement.style.setProperty("--blink-dark", teamcols[data.payload["t"]]+"88");
                    // container.parentElement.classList.add("blink2");
                    container.style.setProperty("--blink-dark", teamcols[data.payload["t"]]+"88");
                    container.classList.add("blink2");
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
            case "game:timeup":{
                createBanner({type:"info",content:`player ${data.payload['n']} ran out of time`});
                break;
            }
            case "game:rules":{
                game.rules = data.payload;
                if (game.rules_loaded) {
                    game.rules_loaded();
                }
                game.rules_loaded = true;
                break;
            }
        }
        return;
        /**
         * case "ping":
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
         */
	});
	document.getElementById("gameboard").addEventListener("mouseup", function(event) {
        if (event.button !== 0) return;
        if (document.getElementById("gameboard").style.getPropertyValue("--disabled") === "1") {
            return;
        }
		if (dbg) {
			// console.log("Click on board");
		}
        if (!game.started) return;
		if (!(ifmt.turn)) {
			return;
		}
		if (ifmt.turn != ifmt.pln) {
			return;
		}
        if (event.target?.nodeName === "CANVAS") {
            window.postMessage({type:"3d-resolveclick",x:event.clientX,y:event.clientY});
            return;
        }
		let d = event.target.id;
		if (d.substring(0, 1) != "r") {
			return;
		}
		if (dbg) {
			// console.log("Click on space on board");
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
    window.addEventListener("message", (ev) => {
        switch (ev.data.type) {
            case "3d-clickresolve":{
                const index = ev.data.index;
                if (index === -1) return;
                if (game.teamboard[index] !== ifmt.pln && game.teamboard[index] !== 0) return;
                conn.send(JSON.stringify({type:"game:move",payload:{n:index}}));
                break;
            }
            case "terri-secviolation":{
                conn.close();
                document.querySelectorAll("script").forEach(v => v.remove());
                throw new Error("SECURITY VIOLATION");
            }
        }
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
        window.dispatchEvent(new CustomEvent("board-update", {board,teamboard,boardold,teamboardold}));
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
