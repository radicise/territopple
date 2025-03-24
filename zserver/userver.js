const { onGameCreated, onGameStarted, onRecordReplay, onPlayerRemoved, onMove } = require("../replayHooks.js");
const { settings, Game, codeChars, extend, emit, on, clear, NetData } = require("../defs.js");

const __dname = process.cwd();

/**@type {Record<string, Game>} */
const games = {};
let GAME_COUNTER = 0n;

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
fs.writeFileSync("www/portno.js", settings.APPEASEMENT ? `const game_port = ${settings.GAMEPORT};\n` : `const game_port = ${settings.WEBPORT};\n`);
if (!fs.existsSync("replays")) {
    fs.mkdirSync("replays");
}
const _path = require("path");
if (!fs.existsSync("www/replays")) {
    fs.symlinkSync(_path.join(__dname, "replays"), _path.join(__dname, "www/replays"));
}
const http = require("http");
// const net = require("net");
const crypto = require("crypto");
const url = require("url");
const socks = require("./socks/handlers.js");
socks.setGlobals({state:globals, settings:settings}, emit, on, clear);
on("main", "player:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    games[gameid].removePlayer(data["n"]);
    games[gameid].sendAll(NetData.Player.Leave(data["n"]));
    if (games[gameid].stats.playing === 0) {
        terminateGame(gameid);
    }
});
on("main", "spectator:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    games[gameid].removeSpectator(data["n"]);
    games[gameid].sendAll(NetData.Spectator.Leave(data["n"]));
});
on("main", "waiting:need-promote", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    const n = games[gameid].getPromotion();
    if (n === null) {
        // games[gameid].sendAll(NetData.Game.Close());
        // games[gameid].kill();
        // delete games[gameid];
        terminateGame(gameid);
        return;
    }
    games[gameid].state.hostNum = n;
    emit("main", "waiting:promote", {"#gameid":gameid,n});
});
on("main", "game:add", (data) => {
    games[data["id"]] = data["game"];
    games[data["id"]].sort_key = GAME_COUNTER;
    GAME_COUNTER ++;
});
function terminateGame(id) {
    if (!(id in games)) return;
    games[id].sendAll(NetData.Game.Close());
    games[id].kill();
    delete games[id];
}
// on("main", "player:spectate", (data, tag) => {
//     /**@type {string} */
//     const gameid = data["#gameid"];
//     const c = games[gameid].players[data["n"]].conn;
//     games[gameid].removePlayer(data["n"]);
//     const id = games[gameid].addSpectator(c);
//     emit("main", `#META:${tag}`, {"#gameid":gameid,"#id":id});
// });
const { GlobalState } = require("./types.js");
let express, ex_server, main_server;
if (!settings.APPEASEMENT) {
    express = require("express");
    ex_server = express();
    main_server = http.createServer({}, ex_server);
} else {
    main_server = http.createServer((requ, resp) => {// TODO Check request target
        const reqpath = url.parse(requ.url).pathname;
        switch (reqpath) {
            case "/serverlist":
                resp.writeHead(200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
                resp.end(formatServerList());
                return;
            default:
                resp.writeHead(400);
                resp.end();
                return;
        }
    });
}

const ws_server = new ws.Server({server: main_server});
ws_server.on("connection", (sock, req) => {
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

function formatServerList() {
    const arr = Object.values(games).filter(v => v.state.public).sort((a, b) => a.sort_key - b.sort_key);
    return JSON.stringify(arr.slice(0, Math.min(50, arr.length)).map(v => {
        return {
            ident:v.ident,
            capacity:v.stats.maxPlayers,
            playing:v.stats.playing,
            spectating:v.stats.spectating,
            width:v.state.cols,
            height:v.state.rows
        };
    }));
}

if (!settings.APPEASEMENT) {
    const serverListRouter = express.Router();
    serverListRouter.use((req, res, next) => {
        res.send(formatServerList());
    });
    ex_server.use("/serverlist", serverListRouter);
    ex_server.use("/", express.static(_path.resolve(__dname, "www")));
}
// ex_server.get()

main_server.listen(settings.APPEASEMENT ? settings.GAMEPORT : settings.WEBPORT);
// ex_server.listen(8300);
// const rl = require("readline");
// const i = rl.createInterface({input:process.stdin,output:process.stdout});
// i.on("line", (l) => {
//     console.log(`LINE: ${l}`);
//     console.log(eval(l));
// });
if (process.argv.includes("--eval-stdin")) {
    process.stdin.on("data", (d) => {
        const l = d.toString("utf-8");
        console.log(eval(l));
    });
}
