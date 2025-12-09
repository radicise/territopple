const { TTBot, TTBotInstance } = require("./bots.js");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ws = require("ws");
// const child_process = require("child_process");
const socks = require("../socks/handlers.js");
const { settings, emit, on, clear } = require("../../defs.js");
const { DBG } = require("./common.js");

fs.writeFileSync(path.join(process.env.HOME, "serv-pids", "bots.pid"), process.pid.toString());

socks.setGlobals({}, emit, on, clear);

let server;
// const server = http.createServer();
// const wss = new ws.Server({noServer: true});

function connErr(request, socket, args) {
    wss.handleUpgrade(request, socket, [], (sock) => {
        socks.handle("error", sock, args, {});
    });
}

server = http.createServer((req, res) => {
    // console.log(req.url);
    const url = new URL("http://localhost"+req.url);
    const parts = url.pathname.split("/");
    // console.log(parts);
    if (!(url.searchParams.has("k") && url.searchParams.has("n"))) {
        res.writeHead(400).end("Call a locksmith, 'cause you've got no key.");
        return;
    }
    let s = 2;
    // console.log(parts);
    // if (parts[s] === "bots") {
    //     s += 1;
    // }
    if (parts.length < s+2 || isNaN(parts[s+1])) {
        res.writeHead(400).end();
        return;
    }
    const rname = TTBot.resolve(parts[s], Number(parts[s+1]));
    // console.log(rname);
    if (rname === undefined) {
        res.writeHead(404).end();
        return;
    }
    connect(parts[s-1], url.searchParams.get("k"), url.searchParams.get("n"), rname);
    res.writeHead(200).end("Good Try!");
});

/**
 * @param {string} gid
 * @param {string} key
 * @param {string} num
 * @param {string} rname
 */
function connect(gid, key, num, rname) {
    console.log("CONN");
    console.log(gid);
    let conn = new ws.WebSocket(`wss://${settings.ORIGIN}/ws/?t=5&g=${gid}&k=${key}&n=${num}`);
    conn.on("error", (e) => {
        // console.log(e);
        conn.terminate();
    });
    conn.on("close", () => {
        // console.log("CLOSED");
    });
    conn.on("open", async () => {
        // console.log("OPEN");
        /**@type {TTBotInstance} */
        let bot = null;
        let ifmt = {};
        ifmt.pln = 0;
        ifmt.room = null;
        ifmt.turn = 0;
        ifmt.team = 0;

        /**@type {Game} */
        let game = new Game();
        let configed = false;
        conn.addEventListener("message", async (event) => {
            if (typeof event.data !== "string") {
                /**@type {Buffer} */
                const dat = event.data;
                {
                    const v = dat;
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
                        const r = (arr[bypos]>>(8-bipos-n))&(0xff>>(8-n));
                        bipos += n;
                        return r;
                    };
                    const kind = arr[0];
                    switch (kind) {
                        case 0:{
                            const bb = game.board;
                            const tb = game.teamboard;
                            for (let i = 0; i < bb.length; i ++) {
                                game.board[i] = consumebits(game.topology.getRequiredBits(i)) + 1;
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
                            break;
                        }
                    }
                }
                return;
            }
            /**@type {{type:string,payload:Record<string,any>}} */
            const data = JSON.parse(event.data);
            if (!("type" in data && "payload" in data)) {
                return;
            }
            switch (data.type) {
                case "waiting:promote":{
                    game.hostNum = data.payload["n"];
                    break;
                }
                case "waiting:start":{
                    game.started = true;
                    break;
                }
                case "waiting:kick":{
                    let n = data.payload["n"];
                    if (typeof n === "number") {
                        if (ifmt.pln === n) {
                            conn.close();
                            return;
                        }
                        game.joinedPlayers --;
                        game.playerList[n] = null;
                    } else {
                        if (ifmt.team === -1) {
                            if (n === ifmt.pln) {
                                conn.close();
                                return;
                            }
                        }
                    }
                    break;
                }
                case "error":{
                    // console.log(data.payload);
                    conn.close();
                    break;
                }
                case "key:rejoin":{
                    break;
                }
                case "player:join":{
                    game.joinedPlayers ++;
                    game.playerList[data.payload["n"]] = {team:data.payload["t"],time:((game.rules?.turnTime?.limit||0)/1000)||null};
                    break;
                }
                case "player:leave":{
                    game.joinedPlayers --;
                    game.playerList[data.payload["n"]] = null;
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
                    bot = TTBot.instance(rname, ifmt.pln);
                    break;
                }
                case "spectator:join":{
                    break;
                }
                case "spectator:leave":{
                    break;
                }
                case "spectator:ownid":{
                    ifmt.pln = data.payload["n"];
                    ifmt.team = -1;
                    break;
                }
                case "game:roomid":{
                    ifmt.room = data.payload["g"];
                    game.ident = data.payload["g"];
                    {
                        conn.send("{\"type\":\"game:rules\",\"payload\":{}}");
                    }
                    break;
                }
                case "game:config":{
                    const tilecount = data.payload["c"];
                    const dims = data.payload["d"];
                    const topid = data.payload["t"];
                    dims.type = topid;
                    //// TOPOLOGY CONFIG POINT ////
                    if (topid < 4) {
                        rows = tilecount/dims.x;
                        cols = dims.x;
                    } else {
                        throw new Error("unknown topology");
                    }
                    players = data.payload["p"];
                    game.hostNum = data.payload["l"];
                    ifmt.turn = 0;
                    await game.setConfig(dims, players);
                    if (configed) {
                        configed();
                    }
                    configed = true;
                    break;
                }
                case "game:jlist":{
                    /**@type {[number, number][]} */
                    const pl = data.payload["p"];
                    for (const p of pl) {
                        if (ifmt.pln) {
                            if (p[0] === ifmt.pln) continue;
                        }
                        game.joinedPlayers ++;
                        game.playerList[p[0]] = {team:p[1]};
                    }
                    break;
                }
                case "game:reconnected":{
                    game.started = true;
                    break;
                }
                case "game:turn":{
                    ifmt.turn = data.payload["n"];
                    if (game.rules?.turnTime?.limit && data.payload["t"]) {
                        game.runTimer(data.payload['n']);
                    }
                    if (ifmt.turn === ifmt.pln) {
                        game.turn = ifmt.turn;
                        console.log("THINKING");
                        const thunk = await bot.think(game, game.rules?.turnTime?.limit);
                        // console.log(thunk);
                        conn.send(JSON.stringify({type:"game:move",payload:{n:thunk}}));
                    }
                    break;
                }
                case "game:move":{
                    const n = data.payload["n"];
                    const tmu = data.payload["t"];
                    game.move(n, tmu);
                    break;
                }
                case "game:win":{
                    ifmt.turn = 0;
                    game.stopTimer();
                    conn.close();
                    break;
                }
                case "game:timeup":{
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
                case "ping":{
                    break;
                }
            }
        });
    });
}

// server.on("upgrade", (req, socket) => {
//     const url = new URL("http://localhost"+req.url);
//     const parts = url.pathname.split("/");
//     let s = 1;
//     if (parts[1] === "bots") {
//         s = 2;
//     }
//     if (parts.length < s+2 || isNaN(parts[s+1])) {
//         socket.destroy();
//         return;
//     }
//     const rname = TTBot.resolve(parts[s], Number(parts[s+1]));
//     if (rname === undefined) {
//         socket.destroy();
//         return;
//     }
//     wss.handleUpgrade(req, socket, [], async (sock) => {
//         /**@type {TTBotInstance} */
//         let bot = null;
//         let ifmt = {};
//         ifmt.pln = 0;
//         ifmt.room = null;
//         ifmt.turn = 0;
//         ifmt.team = 0;

//         /**@type {Game} */
//         let game = new Game();
//         sock.addEventListener("message", async (event) => {
//             if (typeof event.data !== "string") {
//                 /**@type {Buffer} */
//                 const dat = event.data;
//                 {
//                     const v = dat;
//                     if (!configed) {
//                         await new Promise(r => {configed = r;});
//                     }
//                     const arr = new Uint8Array(v);
//                     let bypos = 1;
//                     let bipos = 0;
//                     const consumebits = (n) => {
//                         if (bipos === 8) {
//                             bypos ++;
//                             bipos = 0;
//                         }
//                         if (bipos + n > 8) {
//                             const rem = 8 - bipos;
//                             const oth = n - rem;
//                             return (consumebits(rem)<<oth)|consumebits(oth);
//                         }
//                         const r = (arr[bypos]>>(8-bipos-n))&(0xff>>(8-n));
//                         bipos += n;
//                         return r;
//                     };
//                     const kind = arr[0];
//                     switch (kind) {
//                         case 0:{
//                             const bb = game.board;
//                             const tb = game.teamboard;
//                             for (let i = 0; i < bb.length; i ++) {
//                                 game.board[i] = consumebits(game.topology.getRequiredBits(i)) + 1;
//                             }
//                             let i = 0;
//                             while (i < tb.length) {
//                                 if (consumebits(1) === 0) {
//                                     tb[i] = consumebits(3);
//                                     i ++;
//                                     continue;
//                                 } else {
//                                     const t = consumebits(3);
//                                     const c = consumebits(4)+1;
//                                     for (let j = 0; j < c; j ++) {
//                                         tb[i+j] = t;
//                                     }
//                                     i += c;
//                                 }
//                             }
//                             game.recalcDerived();
//                             break;
//                         }
//                     }
//                 }
//                 return;
//             }
//             /**@type {{type:string,payload:Record<string,any>}} */
//             const data = JSON.parse(event.data);
//             if (!("type" in data && "payload" in data)) {
//                 return;
//             }
//             switch (data.type) {
//                 case "waiting:promote":{
//                     game.hostNum = data.payload["n"];
//                     break;
//                 }
//                 case "waiting:start":{
//                     game.started = true;
//                     break;
//                 }
//                 case "waiting:kick":{
//                     let n = data.payload["n"];
//                     if (typeof n === "number") {
//                         if (ifmt.pln === n) {
//                             conn.close();
//                             return;
//                         }
//                         game.joinedPlayers --;
//                         game.playerList[n] = null;
//                     } else {
//                         if (ifmt.team === -1) {
//                             if (n === ifmt.pln) {
//                                 conn.close();
//                                 return;
//                             }
//                         }
//                     }
//                     break;
//                 }
//                 case "error":{
//                     conn.close();
//                     break;
//                 }
//                 case "key:rejoin":{
//                     break;
//                 }
//                 case "player:join":{
//                     game.joinedPlayers ++;
//                     game.playerList[data.payload["n"]] = {team:data.payload["t"],time:((game.rules?.turnTime?.limit||0)/1000)||null};
//                     break;
//                 }
//                 case "player:leave":{
//                     game.joinedPlayers --;
//                     game.playerList[data.payload["n"]] = null;
//                     break;
//                 }
//                 case "player:lose":{
//                     game.losePlayer(data.payload["n"]);
//                     break;
//                 }
//                 case "player:spectate":{
//                     break;
//                 }
//                 case "player:ownid":{
//                     ifmt.pln = data.payload["n"];
//                     ifmt.team = data.payload["t"];
//                     game.joinedPlayers ++;
//                     game.playerList[data.payload["n"]] = {team:data.payload["t"],time:((game.rules?.turnTime?.limit||0)/1000)||null};
//                     bot = TTBot.instance(rname, ifmt.pln);
//                     break;
//                 }
//                 case "spectator:join":{
//                     break;
//                 }
//                 case "spectator:leave":{
//                     break;
//                 }
//                 case "spectator:ownid":{
//                     ifmt.pln = data.payload["n"];
//                     ifmt.team = -1;
//                     break;
//                 }
//                 case "game:roomid":{
//                     ifmt.room = data.payload["g"];
//                     game.ident = data.payload["g"];
//                     {
//                         const rstr = sessionStorage.getItem("game_rules");
//                         if (rstr) conn.send(`{"type":"game:rules","payload":${rstr}}`);
//                         else conn.send("{\"type\":\"game:rules\",\"payload\":{}}");
//                     }
//                     break;
//                 }
//                 case "game:config":{
//                     const tilecount = data.payload["c"];
//                     const dims = data.payload["d"];
//                     const topid = data.payload["t"];
//                     dims.type = topid;
//                     //// TOPOLOGY CONFIG POINT ////
//                     if (topid < 4) {
//                         rows = tilecount/dims.x;
//                         cols = dims.x;
//                     } else {
//                         throw new Error("unknown topology");
//                     }
//                     players = data.payload["p"];
//                     game.hostNum = data.payload["l"];
//                     ifmt.turn = 0;
//                     await game.setConfig(dims, players);
//                     if (configed) {
//                         configed();
//                     }
//                     configed = true;
//                     break;
//                 }
//                 case "game:jlist":{
//                     /**@type {[number, number][]} */
//                     const pl = data.payload["p"];
//                     for (const p of pl) {
//                         if (ifmt.pln) {
//                             if (p[0] === ifmt.pln) continue;
//                         }
//                         game.joinedPlayers ++;
//                         game.playerList[p[0]] = {team:p[1]};
//                     }
//                     break;
//                 }
//                 case "game:reconnected":{
//                     game.started = true;
//                     break;
//                 }
//                 case "game:turn":{
//                     ifmt.turn = data.payload["n"];
//                     if (game.rules?.turnTime?.limit && data.payload["t"]) {
//                         game.runTimer(data.payload['n']);
//                     }
//                     if (ifmt.turn === ifmt.pln) {
//                         game.turn = ifmt.turn;
//                         conn.send(JSON.stringify({type:"game:move",payload:{n:bot.think(game, true)}}));
//                     }
//                     break;
//                 }
//                 case "game:move":{
//                     const n = data.payload["n"];
//                     const tmu = data.payload["t"];
//                     game.move(n, tmu);
//                     break;
//                 }
//                 case "game:win":{
//                     ifmt.turn = 0;
//                     game.stopTimer();
//                     conn.close();
//                     break;
//                 }
//                 case "game:timeup":{
//                     break;
//                 }
//                 case "game:rules":{
//                     game.rules = data.payload;
//                     if (game.rules_loaded) {
//                         game.rules_loaded();
//                     }
//                     game.rules_loaded = true;
//                     break;
//                 }
//                 case "ping":{
//                     break;
//                 }
//             }
//         });
//     });
// });

server.listen(settings.BOTPORT);

if (!process.argv.includes("--no-in"))
process.stdin.on("data", (d) => {
    const l = d.toString("utf-8");
    const parts = l.split(/:|;/).map(v => v.trim());
    const uparts = parts.map(v => v.toUpperCase());
    const p1 = uparts[0];
    switch (p1) {
        default:
            if (process.argv.includes("--eval-stdin")) {
                try {
                    console.log(eval(l));
                } catch (E) {
                    try {
                        console.log(DBG(l));
                        return;
                    } catch (E) {}
                    console.error(E.stack);
                }
            } else {
                console.error("UNRECOGNIZED COMMAND");
            }
            break;
    }
});


const topology = new class{
    #m=null;
    set m(v){if(this.#m===null){this.#m=v;}}
    /**@returns {typeof import("../../topology/topology.js")} */
    get m(){return this.#m;}
}();
const loadPromise = new Promise((res,) => {
    import("../../topology/topology.js").then(r => {topology.m = r;res(r);},r => {throw new Error("could not load topology module");});
});

/**
 * @typedef Player
 * @type {{team:number,ready:boolean,time:number}}
 */

class Game {
    constructor() {
        /**@type {string} */
        this.ident = null;
        /**@type {import("../../topology/topology.js").Topology} */
        this.topology = null;
        /**@type {number} */
        this.maxPlayers = null;
        /**@type {number} */
        this.joinedPlayers = 0;
        /**@type {number} */
        this.spectators = null;
        /**@type {number[]} */
        this.board = null;
        /**@type {number[]} */
        this.teamboard = null;
        this.owned = new Array(7).fill(0);
        /**@type {Player[]} */
        this.playerList = [];
        this.started = false;
        this.hostNum = null;
        this.rules = null;
        this.timer = 0;
        this.timerid = null;
        this.timertarget = null;
        this.rules_loaded = false;
        this.turn = -1;
    }
    get players() {
        return this.playerList.map(v => v===null?{alive:false,team:0}:{alive:true,team:v.team});
    }
    stopTimer() {
        if (this.timerid) {
            clearInterval(this.timerid);
            this.timerid = null;
        }
    }
    runTimer(n) {
        this.stopTimer();
        this.timertarget = n;
        this.timer = this.rules.turnTime.limit/1000;
        if (this.timer) {
            this.timerid = setInterval(() => {
                switch (this.rules.turnTime.style) {
                    case "per turn":{
                        if (this.timer) {
                            this.timer --;
                        } else {
                            clearInterval(this.timerid);
                            this.timerid = null;
                        }
                        break;
                    }
                    case "chess":{
                        if (this.playerList[this.timertarget]?.time) {
                            this.playerList[this.timertarget].time --;
                        } else {
                            clearInterval(this.timerid);
                            this.timerid = null;
                        }
                        break;
                    }
                }
            }, 1000);
        }
    }
    /**
     * @param {import("../../topology/topology.js").TopologyParams} params
     * @param {number} players
     */
    async setConfig(params, players) {
        if (!this.rules_loaded) {
            await new Promise(r => {this.rules_loaded = r;});
        }
        await loadPromise;
        this.topology = topology.m.makeTopology(params);
        this.maxPlayers = players;
        this.spectators = 0;
        const tc = this.topology.tileCount;
        this.owned[0] = tc;
        this.board = new Array(tc).fill(1);
        this.teamboard = new Array(tc).fill(0);
        let playerList = new Array(players+1).fill(null);
        for (let i = 0; i < this.playerList.length; i ++) {
            playerList[i] = this.playerList[i];
            if (playerList[i]) {
                playerList[i].time = this.rules.turnTime.limit/1000;
            }
        }
        this.playerList = playerList;
        this.playerList[0] = {team:0};
    }
    recalcDerived() {
        this.owned = new Array(7).fill(0);
        for (let i = 0; i < this.teamboard.length; i ++) {
            this.owned[this.teamboard[i]] ++;
        }
    }
    /**
     * @param {number} tile
     * @param {number} team
     */
    move(tile, team) {
        const adds = [tile];
        const tb = this.teamboard;
        const bb = this.board;
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== team) {
                this.owned[tb[t]] --;
                this.owned[team] ++;
                tb[t] = team;
                if (this.owned[team] === bb.length) {
                    break;
                }
            }
            bb[t] ++;
            const neighbors = this.topology.getNeighbors(t);
            if (bb[t] > neighbors.length) {
                bb[t] -= neighbors.length;
                adds.push(...neighbors);
            }
        }
    }
    /**
     * @param {number} n
     */
    losePlayer(n) {
        const team = this.playerList[n].team;
        this.playerList[n].team = 0;
        if (!this.playerList.some(v => v?.team === team)) {
            this.teamboard.forEach((v, i, a) => {if(v === team)a[i]=0;});
        }
    }
}
exports.Game = Game;
