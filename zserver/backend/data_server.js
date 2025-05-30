const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DEFS = require("../../defs.js");
const { codeChars, settings, validateJSONScheme, JSONScheme, ensureFile, addLog, logStamp } = DEFS;
const { PerformanceError } = require("./errors.js");

// const __dname = process.cwd();

// if (!fs.existsSync(path.join(__dname, "logs/data_server/internal.txt"))) {}
// ensureFile("logs/data_server/internal/crashes.txt");
// ensureFile("logs/data_server/internal/access.txt");
// ensureFile("logs/data_server/external.txt");

const ICRASH = "logs/data_server/internal/crashes.txt";
const IACCESS = "logs/data_server/internal/access.txt";
const IERROR = "logs/data_server/internal/error.txt";
const EXLOG = "logs/data_server/external.txt";

ensureFile(ICRASH);
ensureFile(IACCESS);
ensureFile(IERROR);
ensureFile(EXLOG);

logStamp(ICRASH);
logStamp(IACCESS);
logStamp(IERROR);
logStamp(EXLOG);

/**
 * @type {Record<string,{worker:number,public:boolean,capacity:number,dstr:string,can_spectate:boolean,playing:number,spectating:number,sort_key:bigint}|null>}
 */
const gameInfo = {};

let GAME_COUNTER = 0n;

/**@type {JSONScheme} */
const roomCreateScheme = {
    "worker": "number",
    "public": "boolean",
    "capacity": "number",
    "dstr": "string",
    "can_spectate": "boolean",
    "playing": "number",
    "spectating": "number"
};

let IREQNUM_CNT = 0;

/**
 * local only server
 * coordinates cross-process data
 */
http.createServer((req, res) => {
    const url = new URL("http://localhost"+req.url);
    const TIME = new Date();
    const REQNUM = IREQNUM_CNT ++;
    /**@type {(p: string, d: string) => void} */
    const log = (p, d) => {addLog(p, `${TIME} - ${REQNUM} - ${d}\n`)};
    const afail = () => {log(IACCESS, "FAILURE");};
    const agood = () => {log(IACCESS, "SUCCESS");};
    const epath = () => {log(IERROR, "BAD PATH");};
    // addLog(IACCESS, `${TIME} - ${REQNUM} - ${req.method} - ${url}\n`);
    log(IACCESS, `${req.method} - ${url}`);
    switch (req.method) {
        case "GET":{
            switch (url.pathname) {
                case "/room-id":{
                    try {
                        const code = generateRoomCode();
                        gameInfo[code] = null;
                        res.writeHead(200);
                        res.end(code);
                        // addLog(IACCESS, `${TIME} - ${REQNUM} - SUCCESS: ${code}\n`);
                        log(IACCESS, `SUCCESS - ${code}`);
                    } catch {
                        res.writeHead(503);
                        res.end("code generation taking too long");
                        // log(IACCESS, "FAILURE");
                        afail();
                        log(IERROR, "PERFORMANCE ERROR");
                        // addLog(IACCESS, `${TIME} - ${REQNUM} - FAILURE\n`);
                        // addLog(IERROR, `${TIME} - ${REQNUM}`);
                    }
                    return;
                }
                case "/worker":{
                    const id = url.searchParams.get("id");
                    if (id === null || !(id in gameInfo) || gameInfo[id] === null) {
                        res.writeHead(404).end();
                        // log(IACCESS, "FAILURE");
                        afail();
                        log(IERROR, "BAD ROOM ID");
                        return;
                    }
                    res.writeHead(200);
                    res.end(gameInfo[id].worker.toString());
                    log(IACCESS, `SUCCESS - ${id} -> ${gameInfo[id].worker}`);
                    return;
                }
                default:{
                    res.writeHead(400).end();
                    // log(IACCESS, "FAILURE");
                    afail();
                    // log(IERROR, "BAD PATH");
                    epath();
                    return;
                }
            }
        }
        case "DELETE":{
            switch (url.pathname) {
                case "/room":{
                    const id = url.searchParams.get("id");
                    if (id === null || !(id in gameInfo)) {
                        res.writeHead(404).end();
                        // log(IACCESS, "FAILURE");
                        afail();
                        log(IERROR, "BAD ROOM ID");
                        return;
                    }
                    delete gameInfo[id];
                    res.writeHead(200).end();
                    agood();
                    return;
                }
                case "/worker":{
                    const id = Number(url.searchParams.get("id"));
                    if (isNaN(id)) {
                        res.writeHead(404).end();
                        afail();
                        log(IERROR, "BAD WORKER ID");
                        return;
                    }
                    const rooms = Object.keys(gameInfo).filter(v => gameInfo[v].worker === id);
                    log(IACCESS, `SUCCESS - DELETED ${rooms.length} ROOMS`);
                    rooms.forEach(v => {delete gameInfo[v];});
                    res.writeHead(200).end();
                    return;
                }
                default:{
                    res.writeHead(400).end();
                    afail();
                    // log(IERROR, "BAD PATH");
                    epath();
                    return;
                }
            }
        }
        case "POST":{
            switch (url.pathname) {
                case "/room-created":{
                    const id = url.searchParams.get("id");
                    if (id === null || !(id in gameInfo)) {
                        res.writeHead(404).end();
                        afail();
                        log(IERROR, "BAD ROOM ID");
                        return;
                    }
                    if (gameInfo[id] !== null) {
                        res.writeHead(403).end();
                        afail();
                        log(IERROR, "ROOM ID POPULATED");
                        return;
                    }
                    let data = "";
                    req.on("data", (chunk) => {data += chunk;});
                    req.on("end", () => {
                        log(IACCESS, `BODY:\n${data}`);
                        data = JSON.parse(data);
                        if (!validateJSONScheme(data, roomCreateScheme)) {
                            res.writeHead(422).end();
                            afail();
                            log(IERROR, "MALFORMED JSON");
                            return;
                        }
                        data.playing = data.playing ?? 0;
                        data.spectating = data.spectating ?? 0;
                        data.sort_key = GAME_COUNTER;
                        GAME_COUNTER ++;
                        gameInfo[id] = data;
                        res.writeHead(200).end();
                        agood();
                    });
                    return;
                }
                default:{
                    res.writeHead(400).end();
                    epath();
                    return;
                }
            }
        }
        case "PATCH":{
            switch (url.pathname) {
                case "/room":{
                    const id = url.searchParams.get("id");
                    if (id === null || !(id in gameInfo)) {
                        res.writeHead(404).end();
                        afail();
                        log(IERROR, "BAD ROOM ID");
                        return;
                    }
                    if (gameInfo[id] === null) {
                        res.writeHead(403).end();
                        afail();
                        log(IERROR, "ROOM NOT POPULATED");
                        return;
                    }
                    let data = "";
                    req.on("data", (chunk) => {data += chunk;});
                    req.on("end", () => {
                        log(IACCESS, `BODY:\n${data}`);
                        data = JSON.parse(data);
                        if (!validateJSONScheme(data, {"playing": "number","spectating": "number"})) {
                            res.writeHead(422).end();
                            afail();
                            log(IERROR, "MALFORMED JSON");
                            return;
                        }
                        gameInfo[id].playing = data.playing;
                        gameInfo[id].spectating = data.spectating;
                        res.writeHead(200).end();
                        agood();
                    });
                    return;
                }
                default:{
                    res.writeHead(400).end();
                    epath();
                    return;
                }
            }
        }
    }
}).listen(settings.INTERNALPORT);

const codeArr = new Uint16Array(settings.ROOM_CODE_LENGTH);

/**
 * generates a room code, the generated code is guaranteed to not already be in use
 * throws a PerformanceError if a code takes too long to be generated
 * @throws {PerformanceError}
 * @returns {string}
 */
function generateRoomCode() {
    let code = "";
    let c = 0;
    while (true) {
        if (c > 500) {
            throw new PerformanceError("room code generation");
        }
        c ++;
        crypto.getRandomValues(codeArr);
        for (let i = settings.ROOM_CODE_LENGTH; i; i --) {
            code += codeChars[codeArr[i - 1] % codeChars.length];
        }
        if (code in gameInfo) {
            code = "";
            continue;
        }
        break;
    }
    return code;
}

/**
 * proxied server
 * supports things like server list
 */
http.createServer((req, res) => {
    const url = new URL("http://localhost"+req.url);
    if (url.pathname === "/serverlist") {
        res.writeHead(200, {"content-type":"application/json"});
        res.end(formatServerList((Number(url.searchParams.get("page")) || 1) - 1));
        return;
    }
}).listen(settings.DATAPORT);

/**
 * @param {number} page
 * @returns {string}
 */
function formatServerList(page) {
    const arr = Object.entries(gameInfo).filter(v => v[1] !== null).filter(v => v[1].public).sort((a, b) => Number(a[1].sort_key - b[1].sort_key));
    if (page < 0 || page*50 >= arr.length) {
        return "[]";
    }
    return JSON.stringify(arr.slice(page*50, Math.min(page*50+50, arr.length)).map(v => {
        return {
            ident:v[0],
            capacity:v[1].capacity,
            playing:v[1].playing,
            spectating:v[1].spectating,
            dstr:v[1].dstr,
            can_spectate:v[1].can_spectate
        };
    }));
}

process.stdin.on("data", (d) => {
    const l = d.toString("utf-8");
    const parts = l.split(/:|;/).map(v => v.trim());
    const uparts = parts.map(v => v.toUpperCase());
    // console.log(parts);
    // console.log(uparts);
    const p1 = uparts[0];
    switch (p1) {
        // case "TOOL":
        //     if (parts.length < 3) {
        //         if (uparts[1] === "LIST") {
        //             console.log(Object.keys(SERVER_TOOL_FLAGS));
        //             return;
        //         }
        //         console.error("INCOMPLETE SERVERTOOL COMMAND");
        //         return;
        //     }
        //     const method = uparts[1];
        //     const toolname = isNaN(uparts[2]) ? uparts[2].replaceAll("-","_") : Object.keys(SERVER_TOOL_FLAGS)[Number(parts[2])];
        //     if (!(toolname in SERVER_TOOL_FLAGS)) {
        //         console.error("BAD TOOLNAME");
        //         return;
        //     }
        //     switch (method) {
        //         case "GET":
        //             console.log(`TOOL:${toolname} is ${SERVER_TOOL_FLAGS[toolname]}`);
        //             return;
        //         case "SET":
        //             if (parts.length < 4) {
        //                 console.error("INCOMPLETE SERVERTOOL SET");
        //                 return;
        //             }
        //             const value = parts[3].toLowerCase();
        //             const vidx = ["true","false","on","off","enabled","disabled","1","0","y","n"].indexOf(value);
        //             if (vidx === -1) {
        //                 console.error("BAD SERVERTOOL SET VALUE");
        //                 return;
        //             }
        //             SERVER_TOOL_FLAGS[toolname] = vidx%2 === 0;
        //             console.log(`TOOL:${toolname} = ${vidx%2===0}`);
        //             return;
        //         default:
        //             console.error("BAD SERVERTOOL METHOD");
        //             return;
        //     }
        default:
            if (process.argv.includes("--eval-stdin")) {
                try {
                    console.log(eval(l));
                } catch (E) {
                    console.error(E.stack);
                }
            } else {
                console.error("UNRECOGNIZED COMMAND");
            }
            break;
    }
});
