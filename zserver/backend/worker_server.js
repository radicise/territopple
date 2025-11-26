const http = require("http");
const fs = require("fs");
const path = require("path");
const ws = require("ws");
const socks = require("../socks/handlers.js");
const { settings, validateJSONScheme, JSONScheme, Game, emit, on, clear, NetData, loadPromise, ensureFile, logStamp, addLog } = require("../../defs.js");
const { GlobalState } = require("../types.js");
const { PerformanceError } = require("./errors.js");
const crypto = require("crypto");

const LOGF = `logs/worker/${process.pid}.txt`;

const LOGGING = false;

let log = (s) => {};
if (LOGGING) {
    ensureFile(LOGF);
    logStamp(LOGF);
    log = (s) => {addLog(LOGF, `${new Date()} - ${s}\n`);};
}

let CONNECTION_COUNT = 0;
let MAX_TURN = 0;
let COMPLEXITY = 0;

let WORK_ID = null;
let DYING = false;

/**@type {Record<string, Game>} */
const games = {};

/**@type {GlobalState} */
const globals = {
    MAX_DIM: 36,
    MIN_DIM: 1,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 10,
    games: games,
    get saveReplays() {
        return settings.REPLAYS.ENABLED;
        // return SERVER_TOOL_FLAGS.SAVE_REPLAYS;
    }
};

/**
 * @param {string} id
 */
function updateDataServerStats(id) {
    http.request(`http://localhost:${settings.INTERNALPORT}/room?id=${id}`, {"method":"PATCH"}, (res) => {}).end(JSON.stringify({playing:games[id].stats.playing,spectating:games[id].stats.spectating,phase:["wait","play","over"][games[id].state.state]}));
}
function updateLoadFactors() {
    process.send({factor_update:{connections:CONNECTION_COUNT,complexity:COMPLEXITY,turnaround:MAX_TURN}});
}

socks.setGlobals({state:globals, settings:settings}, emit, on, clear);
on("main", "game:bot", (data) => {
    // try {
    //     new ws.WebSocket("ws://localhost", {port:settings.BOTPORT, path:data.bot}).on("open", (s) => {
    //         try {
    //             console.log("OPEN");
    //             socks.handle("join", s, {"id":data["#gameid"],"asSpectator":false}, {});
    //         } catch (E) {
    //             console.log(E);
    //         }
    //     });
    // } catch (E) {
    //     console.log(E)
    // }
    const key = crypto.randomBytes(64).toString("base64url");
    const n = games[data["#gameid"]].addBot(key);
    const u = `http://localhost:${settings.BOTPORT}/${data["#gameid"]}/${data.bot}?k=${key}${n}`;
    // console.log(u);
    // const req = http.request(u, {method:"GET",timeout:200})
    const req = http.get(u);
    req.once("response", (res) => {
        res.on("error", () => {});
        // console.log(res.statusCode);
    });
    req.on("error", (e) => {
        // console.log(e);
    });
});
on("main", "?phase", (data) => {
    updateDataServerStats(data["#gameid"]);
});
on("main", "player:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    log(`GAME ${gameid}, player:leave\n${JSON.stringify(data)}\n${new Error().stack}`);
    games[gameid].removePlayer(data["n"]);
    games[gameid].sendAll(NetData.Player.Leave(data["n"]));
    CONNECTION_COUNT --;
    if (games[gameid].stats.playing === 0) {
        terminateGame(gameid);
    } else {
        updateDataServerStats(gameid);
    }
    updateLoadFactors();
});
on("main", "spectator:leave", (data) => {
    /**@type {string} */
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    games[gameid].removeSpectator(data["n"]);
    CONNECTION_COUNT --;
    games[gameid].sendAll(NetData.Spectator.Leave(data["n"]));
    updateDataServerStats(gameid);
    updateLoadFactors();
});
on("main", "player:join", (data) => {
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    updateDataServerStats(gameid);
});
on("main", "spectator:join", (data) => {
    const gameid = data["#gameid"];
    if (!(gameid in games)) return;
    updateDataServerStats(gameid);
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
    /**@type {Game} */
    const game = data["game"];
    games[data["id"]] = game;
    // games[data["id"]].sort_key = GAME_COUNTER;
    // GAME_COUNTER ++;
    COMPLEXITY += game.complexity;
    http.request(`http://localhost:${settings.INTERNALPORT}/room-created?id=${data['id']}`, {method:"POST"}, (res) => {}).end(JSON.stringify({worker:WORK_ID,public:game.state.public,capacity:game.stats.maxPlayers,dstr:game.state.topology.dimensionString,can_spectate:game.state.observable,playing:game.stats.playing,spectating:game.stats.spectating}));
});
function terminateGame(id) {
    // console.log(`${new Error().stack}`);
    if (!(id in games)) return;
    games[id].sendAll(NetData.Game.Close());
    games[id].kill();
    COMPLEXITY -= games[id].complexity;
    http.request(`http://localhost:${settings.INTERNALPORT}/room?id=${id}`, {method:"DELETE"}).end();
    delete games[id];
}

const wss = new ws.Server({noServer: true});

/**
 * @param {string} rid
 */
function hSwitch(rid) {
    games[rid].sendAll(NetData.CONN.HOLD());
    games[rid].players.forEach(p => p.conn.emit("HOLD"));
}

process.once("message", (id) => {
    WORK_ID = id;
    const WCRASH = `logs/worker_server/${id}_crashes.txt`;
    if (LOGGING) {
        ensureFile(WCRASH);
        logStamp(WCRASH);
    }
    loadPromise.then(v => {globals.topology = v;
        process.on("message", (req, socket) => {
            // if (globals.topology === undefined) {
            //     socket.destroy();
            //     return;
            // }
            if ("cmd" in req) {
                if (process.argv.includes("--debug")) {
                    try {
                        console.log(eval(req.cmd));
                    } catch (E) {
                        console.error(E.stack);
                    }
                }
                return;
            }
            if ("switch" in req) {
                if (req.switch === true) {
                    DYING = true;
                    return;
                }
                if (req.switch === false) {
                    const rid = Object.keys(games);
                    hSwitch(rid);
                    process.send({switch:rid});
                    return;
                }
                hSwitch(req.switch);
                return;
            }
            if ("import" in req) {
                return;
            }
            if ("export" in req) {
                return;
            }
            if ("shift" in req) {
                return;
            }
            const url = new URL("http://localhost"+req.url);
            const connType = Number(url.searchParams.get("t"));
            let gameid;
            let acc;
            let state = {};
            console.log(req.headers.cookie);
            const p = req.headers.cookie?.indexOf("sessionId");
            if (p !== undefined && p !== -1) {
                const e = req.headers.cookie.indexOf(";", p+10);
                const id = req.headers.cookie.substring(p+10, e>0?e:undefined);
                http.get(`http://localhost:${settings.AUTHINTERNALPORT}/resolve-session?id=${id}`, (res) => {
                    if (res.statusCode !== 200) {
                        return;
                    }
                    let data = "";
                    res.on("data", (chunk) => {data += chunk;});
                    res.on("end", () => {
                        acc = data;
                        if (gameid) {
                            emit("main", "account:found", {"#gameid":gameid, "n":state.playerNum?state.playerNum:state.spectatorId, "a":acc});
                        }
                    });
                });
            }
            if (req.hid !== undefined) {
                if (DYING) {process.send({hid:req.hid, v:false});return;}
                const capacity = Number(url.searchParams.get("p"));
                if (CONNECTION_COUNT + capacity >= settings.WORKERS.MAX_CONNECTIONS) {
                    process.send({hid:req.hid, v:false});
                    return;
                }
                if (MAX_TURN >= settings.WORKERS.MAX_TURNAROUND) {
                    process.send({hid:req.hid, v:false});
                    return;
                }
                CONNECTION_COUNT += capacity;
                process.send({hid:req.hid, v:true});
                wss.handleUpgrade(req, socket, [], (sock) => {
                    startPings(sock);
                    http.request(`http://localhost:${settings.INTERNALPORT}/room-id`, {method:"GET"}, (res) => {
                        let data = "";
                        res.on("data", (chunk) => {data += chunk;});
                        res.on("end", () => {
                            try {
                                if (res.statusCode === 503) {
                                    socks.handle("error", sock, {data:"Unable to generate room code",redirect:"/play-online",store:"Unable to generate room code"}, state);
                                    return;
                                }
                                gameid = data;
                                socks.handle("create", sock, {"type":connType, "dims":url.searchParams.get("d"), "players":url.searchParams.get("p"), "spectators":(url.searchParams.get("s")??"1")==="1", "id":data, "acc":acc}, state);
                            } catch (E) {
                                if (LOGGING) addLog(WCRASH, `${new Date()} - CRASH:\n${E.stack}\n`);
                            }
                        });
                    }).end();
                });
            } else {
                wss.handleUpgrade(req, socket, [], (sock) => {
                    try {
                        if (DYING) {
                            sock.send(NetData.CONN.DYNG());
                            setTimeout(() => socks.handle("close", sock), 250);
                            return;
                        }
                        const gid = url.searchParams.get("g");
                        if (!(gid in games)) {
                            socks.handle("error", sock, {data:"Game Not Found",redirect:"/play-online",store:"Game Not Found"}, state);
                            return;
                        }
                        gameid = gid;
                        startPings(sock);
                        if (connType === 3) {
                            socks.handle("rejoin", sock, {"id":gid, "n":url.searchParams.get("i"), "key":url.searchParams.get("k"), "acc":acc}, state);
                            return;
                        }
                        if (connType === 5) {
                            socks.handle("botjoin", sock, {"id":gid, "n":url.searchParams.get("n"), "key":url.searchParams.get("k")}, state);
                            return;
                        }
                        socks.handle("join", sock, {"id":gid, "asSpectator":connType===4, "acc":acc}, state);
                    } catch (E) {
                        if (LOGGING) addLog(WCRASH, `${new Date()} - CRASH:\n${E.stack}\n`);
                    }
                });
            }
        });
    });
});

/**
 * @param {ws.WebSocket} sock
 */
function startPings(sock) {
    const intId = setInterval(() => {
        try {
            sock.ping();
        } catch {
            clearInterval(intId);
        }
    }, 30000);
    sock.on("close", () => {clearInterval(intId);});
    sock.on("error", () => {clearInterval(intId);});
}
