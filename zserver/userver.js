const { onGameCreated, onGameStarted, onRecordReplay, onPlayerRemoved, onMove } = require("../replayHooks.js");
const { settings, Game, codeChars, extend, emit, on, clear, NetData } = require("../defs.js");

const __dname = process.cwd();

/**@type {Record<string, Game>} */
const games = {};

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

/**@type {GlobalState} */
const globals = {
    MAX_DIM: 36,
    MIN_DIM: 1,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 10,
    games: games
};
console.log("Starting server . . .");
const ws = require("ws");
const fs = require("fs");
if (!fs.existsSync("replays")) {
    fs.mkdirSync("replays");
}
const _path = require("path");
if (!fs.existsSync("www/replays")) {
    fs.symlinkSync(_path.join(__dname, "replays"), _path.join(__dname, "www/replays"));
}
const http = require("http");
const net = require("net");
const crypto = require("crypto");
const url = require("url");
const socks = require("./socks/handlers.js");
socks.setGlobals({state:globals, settings:settings}, emit, on, clear);
on("main", "player:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    games[gameid].removePlayer(data["n"]);
    games[gameid].sendAll(NetData.Player.Leave(data["n"]));
});
on("main", "spectator:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    games[gameid].removeSpectator(data["n"]);
    games[gameid].sendAll(NetData.Spectator.Leave(data["n"]));
});
on("main", "waiting:need-promote", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    const n = games[gameid].getPromotion();
    if (n === null) {
        games[gameid].sendAll(NetData.Game.Close());
        games[gameid].kill();
        delete games[gameid];
        return;
    }
    games[gameid].state.hostNum = n;
    emit("main", "waiting:promote", {"#gameid":gameid,n});
});
on("main", "game:add", (data) => {
    games[data["id"]] = data["game"];
});
// on("main", "player:spectate", (data, tag) => {
//     /**@type {string} */
//     const gameid = data["#gameid"];
//     const c = games[gameid].players[data["n"]].conn;
//     games[gameid].removePlayer(data["n"]);
//     const id = games[gameid].addSpectator(c);
//     emit("main", `#META:${tag}`, {"#gameid":gameid,"#id":id});
// });
const express = require("express");
const { GlobalState } = require("./types.js");
const ex_server = express();
// const expressWs = require("express-ws")(ex_server);

const main_server = http.createServer({}, ex_server);

const ws_server = new ws.Server({server: main_server});
// /**@type {ws.WebSocket} */
// let x = ws_server.clients.values().next().value;
// x.on("close", () => {});
ws_server.on("connection", (sock, req) => {
// ex_server.ws("/", (sock, req) => {
    let params = null;
    try {
        const rurl = (new URL(`http://localhost${req.url}`));
        params = rurl.searchParams;
    } catch (et) {
        sock.terminate();
        return;
    }
    const connType = Number(params.get("t"));
    let state = {};
    switch (connType) {
        case 4:
        case 0:socks.handle("join", sock, {"id":params.get("g"), "asSpectator":connType===4}, state);break;
        case 1:
        case 2:socks.handle("create", sock, {"type":connType, "width":params.get("w"), "height":params.get("h"), "players":params.get("p"), "id":genCode()}, state);break;
        case 3:socks.handle("rejoin", sock, {"id":params.get("g"), "n":params.get("i"), "key":params.get("k")}, state);break;
    }
    // sock.on("message", (data, bin) => {
    // });
});

ex_server.use("/", express.static(_path.resolve(__dname, "www")));
// ex_server.get()

main_server.listen(8300);
// ex_server.listen(8300);
// const rl = require("readline");
// const i = rl.createInterface({input:process.stdin,output:process.stdout});
// i.on("line", (l) => {
//     console.log(`LINE: ${l}`);
//     console.log(eval(l));
// });
process.stdin.on("data", (d) => {
    const l = d.toString("utf-8");
    console.log(eval(l));
});
