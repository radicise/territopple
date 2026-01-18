const http = require("http");
const fs = require("fs");
const path = require("path");
const DEFS = require("../../defs.js");
const { codeChars, settings, validateJSONScheme, JSONScheme, ensureFile, addLog, logStamp } = DEFS;
const mdb = require("mongodb");
const { Permissions, check_permission } = require("../accounts/perms.js");

{
    const PID_FILE = path.join(settings.DEVOPTS?.pid_dir??path.join(process.env.HOME, "serv-pids"), "puzs.pid");
    ensureFile(PID_FILE);
    fs.writeFileSync(PID_FILE, process.pid.toString());
}

const INDEXLOG = "logs/puzzles/index.txt";
const ERRORLOG = "logs/puzzles/error.txt";
const INFOLOG = "logs/puzzles/info.txt";
ensureFile(INDEXLOG);
ensureFile(ERRORLOG);
ensureFile(INFOLOG);
logStamp(INDEXLOG);
logStamp(ERRORLOG);
logStamp(INFOLOG);

if (!fs.existsSync("www/puzs")) {
    fs.symlinkSync(path.join(DEFS.__dname, "puzzles"), path.join(DEFS.__dname, "www", "puzs"));
}
if (!settings.DB_CONFIG?.URI) {
    throw new Error("no database uri");
}
const client = new mdb.MongoClient(settings.DB_CONFIG.URI);
const db = client.db("puzzles");
const collection = db.collection("index");
const under_review = db.collection("under-review");

/**
 * @typedef {{filename:string,variants:number,has:number,players:number,dims:number[],author:string,name:string,__special_priority:number,topology:number|null,description:string}} FilterRecord
 */

(async()=>{
    const version0 = (await import("../../www/helpers/comparse/puzzle.mjs")).version0;
    /**
     * @param {string} puzpath
     * @param {number} variant
     * @param {number[]} moves
     * @param {number} total
     */
    async function verifySolution(puzpath, variant, moves, total) {
        const elimorder = [];
        const puzzleinfo = version0(await fs.promises.readFile(puzpath));
        const movehist = new Array(puzzleinfo.PC+1).fill(0).map(_ => [-1]);
        const variantinfo = puzzleinfo.variants[variant];
        const puzzle = {
            owned: new Array(6).fill(0),
            board: Uint8Array.from(puzzleinfo.initial_board[0]),
            teamboard: Uint8Array.from(puzzleinfo.initial_board[1]),
            players: new Array(puzzleinfo.PC+1).fill(true),
            turns: new Array(puzzleinfo.PC+1).fill(1),
            turn: puzzleinfo.TURNS[0],
            turnindex: 0
        };
        for (let i = 0; i < puzzle.teamboard.length; i ++) puzzle.owned[puzzle.teamboard[i]] ++;
        function doMove(team, tile) {
            const adds = [tile];
            const bb = puzzle.board;
            const tb = puzzle.teamboard;
            while (adds.length) {
                const t = adds.pop();
                if (tb[t] !== team) {
                    puzzle.owned[tb[t]] --;
                    if (puzzle.owned[0] === 0 && puzzle.owned[tb[t]] === 0) {
                        if (tb[t] === 0) {
                            puzzle.players.forEach((v, i) => {if(v&&puzzle.owned[puzzleinfo.TEAMS[i]]===0){puzzle.players[i]=false;elimorder.push(i)}});
                        } else {
                            puzzle.players.forEach((v, i) => {if(v&&puzzleinfo.TEAMS[i]===tb[t]){puzzle.players[i]=false;elimorder.push(i)}});
                        }
                    }
                    puzzle.owned[team] ++;
                    tb[t] = team;
                    if (puzzle.owned[team] === bb.length) {
                        return true;
                    }
                }
                bb[t] ++;
                const n = puzzleinfo.topology.getNeighbors(t);
                if (bb[t] > n.length) {
                    bb[t] -= n.length;
                    adds.push(...n);
                }
            }
            movehist[puzzle.turn].push(tile);
            puzzle.turns[puzzle.turn] ++;
            while (true) {
                puzzle.turnindex ++;
                puzzle.turnindex %= puzzleinfo.TURNS.length;
                puzzle.turn = puzzleinfo.TURNS[puzzle.turnindex];
                if (!puzzle.players[puzzle.turn]) continue;
                break;
            }
            return false;
        }
        function getNPCMove() {
            const npc = variantinfo.BOTS[puzzle.turn];
            if (variantinfo.TURN_FLAGS & 0x80) {
                const rec = variantinfo.MOVES[puzzle.turn];
                if (rec) {
                    const mv = rec[puzzle.turns[puzzle.turn]];
                    if (mv) {
                        if (mv.relto !== false) {
                            let pid = puzzle.turn - mv.relto;
                            if (pid < 1) {
                                pid += puzzleinfo.PC;
                            }
                            return movehist[pid][puzzle.turns[pid]-mv.tindex-1];
                        } else {
                            return mv.tindex;
                        }
                    }
                }
            }
            if (npc.length === 0) {
                return false;
            }
        }
        let i = 0;
        let m = 0;
        while (m < total) {
            if (variantinfo.CPS.includes(puzzle.turn)) {
                if (i >= moves.length) return false;
                doMove(puzzleinfo.TEAMS[puzzle.turn], moves[i]);
                i ++;
            } else {
                const mv = getNPCMove();
                if (mv === false) {
                    break;
                }
                doMove(puzzleinfo.TEAMS[puzzle.turn], mv);
            }
            m ++;
        }
        switch (variantinfo.GOAL_ID) {
            case 0:{
                if (variantinfo.CPS.some(p => puzzle.owned[puzzleinfo.TEAMS[p]]===puzzleinfo.topology.tileCount)) {
                    return true;
                }
                return false;
            }
            case 1:{
                if (variantinfo.CPS.every(p => puzzle.owned[puzzleinfo.TEAMS[p]]===0)) {
                    return true;
                }
                return false;
            }
            case 2:{
                const cond = (v, i) => {
                    if (v===(i+1))return true;
                    const ix = elimorder.indexOf(i+1);
                    if(v===255)return ix===-1;
                    const iy = elimorder.indexOf(v);
                    return ix >= 0 && iy >= 0 && iy < ix;
                };
                if (variantinfo.ORDER.every(cond)) {
                    return true;
                }
                return false;
            }
            case 3:{
                if (puzzle.board.every((v, i) => variantinfo.target_state[0][i]===v) && puzzle.teamboard.every((v, i) => variantinfo.target_state[1][i]===v)) {
                    return true;
                }
                return false;
            }
        }
        return false;
    }
    // process.on("SIGUSR1", async () => {
    //     /**@type {FilterRecord[]} */
    //     const index = [];
    //     await Promise.allSettled(fs.readdirSync(path.join(DEFS.__dname, "puzzles")).map((n) => {
    //         return new Promise(resolve => {
    //             console.log(n);
    //             if (!n.endsWith(".tpzl")) return resolve();
    //             fs.readFile(path.join(DEFS.__dname, "puzzles", n), (err, data) => {
    //                 console.log(err);
    //                 if (err) return resolve();
    //                 const info = version0(data);
    //                 let goals = 0;
    //                 for (const vari of info.variants) {
    //                     goals |= (1<<vari.GOAL_ID);
    //                     if (goals === 15) break;
    //                 }
    //                 index.push({filename:n.substring(0, n.length-5),variants:info.VC,has:goals,players:info.PC,dims:info.TPARAMS,author:info.author,name:info.name,topology:info.topology_rules.id??-1,description:info.info_str});
    //                 resolve();
    //             });
    //         });
    //     }));
    //     // const resp = await collection.bulkWrite(index.map(v => {return {replaceOne:{filter:{filename:v.filename,__special_priority:{$exists:false}},replacement:v,upsert:true}};}));
    //     const resp = await collection.bulkWrite(index.map(v => {return {insertOne:{document:v}};}));
    //     addLog(INDEXLOG, `INDEXED\nupdated: ${resp.modifiedCount}\ninserted: ${resp.insertedCount}\nupserted: ${resp.upsertedCount}\nerrors: ${resp.getWriteErrors().length}\n`);
    // });
    const server = http.createServer(async (req, res) => {
        const url = new URL("http://localhost"+req.url);
        const p = req.headers.cookie?.indexOf("sessionId");
        let acctok;
        if (p !== undefined && p !== -1) {
            const e = req.headers.cookie.indexOf(";", p+10);
            acctok = req.headers.cookie.substring(p+10, e>0?e:undefined);
        }
        switch (req.method) {
            case "GET": {
                switch (url.pathname) {
                    case "/puz/list": {
                        try {
                            /**@type {FilterRecord[]} */
                            const arr = (await collection.find().limit(20).sort({"_id":1,"name":1,"__special_priority":1}).project({_id:0}).toArray());
                            res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(arr));
                        } catch (E) {
                            addLog(ERRORLOG, `${E}`);
                            res.writeHead(503).end();
                        }
                        return;
                    }
                    case "/puz/info": {
                        res.writeHead(503).end();
                        return;
                    }
                    case "/puz/review": {
                        if (!acctok) {
                            res.writeHead(403).end();
                            return;
                        }
                        const perms = await new Promise((rs) => {
                            http.request(`0.0.0.0:${settings.AUTHINTERNALPORT}/get-privs?id=${acctok}`, (resp) => {
                                if (resp.statusCode === 200) {
                                    let data = "";
                                    resp.on("data", (chunk) => {data += chunk;});
                                    resp.once("end", () => {
                                        resp.removeAllListeners();
                                        if (isNaN(data)) {
                                            rs(null);
                                            return;
                                        }
                                        rs(Number.parseInt(data));
                                    });
                                    resp.once("error", () => {resp.removeAllListeners();rs(null);});
                                } else {
                                    rs(null);
                                }
                            });
                        });
                        if (perms === null) {
                            res.writeHead(500).end();
                            return;
                        }
                        if (!check_permission(perms, Permissions.REVIEW_PUZZLES)) {
                            res.writeHead(403).end();
                            return;
                        }
                        try {
                            const puzzles = await under_review.find().sort("sdate","asc").skip(20*(Number(url.searchParams.get("page"))||0)).limit(20).toArray();
                            res.writeHead(200).end(JSON.stringify(puzzles));
                        } catch (E) {
                            console.log(E);
                            res.writeHead(500).end();
                        }
                        return;
                    }
                    default: {
                        res.writeHead(404).end();
                        return;
                    }
                }
            }
            case "POST": {
                if (!acctok) {
                    res.writeHead(403).end();
                    return;
                }
                switch (url.pathname) {
                    case "/puz/verify":{
                        // res.writeHead(503).end();
                        // if (true) return;
                        const puz = url.searchParams.get("puz");
                        if (!puz) {
                            res.writeHead(404).end();
                            return;
                        }
                        const puzpath = path.join(DEFS.__dname, "puzzles", `${puz}.tpzl`);
                        if (!puz || !fs.existsSync(puzpath)) return res.writeHead(404).end();
                        const pzid = (await collection.findOne({name:puz}))?.id;
                        if (!pzid) return res.writeHead(500).end();
                        /**@type {string} */
                        const body = await new Promise((r, s) => {
                            let d = "";
                            req.on("data", (data) => {d += data});
                            req.on("end", ()=>r(d));
                            req.on("error", s);
                        });
                        if (body.length < 11) {
                            res.writeHead(400).end();
                            return;
                        }
                        try {
                            /**@type {number[]} */
                            const moves = JSON.parse(body.slice(5));
                            const variant = Number.parseInt(body.slice(0,2),16);
                            const total = Number.parseInt(body.slice(2,11),16);
                            if (await verifySolution(puzpath, variant, moves, total)) {
                                http.request(`0.0.0.0:${settings.AUTHINTERNALPORT}/add-completed-puzzle?id=${acctok}&pzvid=${pzid|(1<<(26+variant))}`, {method:"PATCH"}, (resp) => {
                                    if (resp.statusCode === 200) {
                                        res.writeHead(200).end();
                                    } else {
                                        res.writeHead(resp.statusCode < 500 ? 400 : 500).end();
                                    }
                                });
                            } else {
                                res.writeHead(403).end();
                            }
                        } catch {
                            res.writeHead(500).end();
                        }
                        return;
                    }
                    case "/puz/submit":{
                        res.writeHead(503).end();
                        return;
                    }
                    case "/puz/publish":{
                        res.writeHead(503).end();
                        return;
                    }
                    default:{
                        res.writeHead(404).end();
                        return;
                    }
                }
            }
        }
    });
    
    addLog(INFOLOG, `listening on port ${settings.PUZZLEPORT}`);
    server.listen(settings.PUZZLEPORT);
})();
