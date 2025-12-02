const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DEFS = require("../../defs.js");
const { codeChars, settings, validateJSONScheme, JSONScheme, ensureFile, addLog, logStamp, __dname } = DEFS;
const { PerformanceError } = require("./errors.js");
const { TTBot } = require("../bots/bots.js");

fs.writeFileSync("www/portno.js", settings.APPEASEMENT ? `const game_port = ${settings.GAMEPORT};\n` : `const game_port = ${settings.WEBPORT};\n`);
if (!fs.existsSync("replays")) {
    fs.mkdirSync("replays");
}
if (!fs.existsSync("operator.json")) {
    fs.writeFileSync("operator.json", JSON.stringify({"contact":{"name":"unkown","methods":{}}}), {encoding:"utf-8"});
}
const _path = path;
if (!fs.existsSync("www/operator.json")) {
    fs.symlinkSync(_path.join(__dname, "operator.json"), _path.join(__dname, "www/operator.json"));
}
if (!fs.existsSync("www/replays")) {
    fs.symlinkSync(_path.join(__dname, "replays"), _path.join(__dname, "www/replays"));
}
if (!fs.existsSync("www/topology")) {
    fs.symlinkSync(_path.join(__dname, "topology"), _path.join(__dname, "www/topology"));
}
if (!fs.existsSync("www/three")) {
    fs.symlinkSync(_path.join(__dname, "node_modules/three"), _path.join(__dname, "www/three"));
}

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
 * @typedef {{worker:number,public:boolean,capacity:number,dstr:string,can_spectate:boolean,playing:number,spectating:number,sort_key:bigint,dbase:string,dparams:number,phase:"wait"|"play"|"over"}} GameInfo
 */

/**
 * @type {Record<string,GameInfo|null>}
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
                    // console.log(id);
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
                    /**@type {GameInfo} */
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
                        data.dbase = data.dstr.slice(0, data.dstr.lastIndexOf(" "));
                        data.dparams = data.dstr.slice(data.dstr.lastIndexOf(" ")+1).split(/[^\d]/).map(v => Number(v));
                        data.playing = data.playing ?? 0;
                        data.spectating = data.spectating ?? 0;
                        data.sort_key = GAME_COUNTER;
                        data.phase = "wait";
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
                        if (!validateJSONScheme(data, {"playing": "number","spectating": "number","phase": "string"})) {
                            res.writeHead(422).end();
                            afail();
                            log(IERROR, "MALFORMED JSON");
                            return;
                        }
                        gameInfo[id].playing = data.playing;
                        gameInfo[id].spectating = data.spectating;
                        gameInfo[id].phase = data.phase;
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

const codeArr = new Uint8Array(settings.ROOM_CODE_LENGTH);

/**
 * generates a room code, the generated code is guaranteed to not already be in use
 * throws a PerformanceError if a code takes too long to be generated
 * @throws {PerformanceError}
 * @returns {string}
 */
function generateRoomCode() {
    let code = "";
    let c = 0;
    const day = Math.floor(Date.now()/86400000)-20358;
    while (true) {
        if (c > 50) {
            throw new PerformanceError("room code generation");
        }
        c ++;
        crypto.getRandomValues(codeArr);
        codeArr[settings.ROOM_CODE_LENGTH-1] = (day>>16)&0xff;
        codeArr[settings.ROOM_CODE_LENGTH-2] = (day>>8)&0xff;
        codeArr[settings.ROOM_CODE_LENGTH-3] = day&0xff;
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
 * @param {FilterObj} filter
 * @returns {boolean}
 */
function checkFilter(filter) {
    if ("topo" in filter) {
        if (filter.topo.length > 4) return false;
    }
    return true;
}

/**
 * proxied server
 * supports things like server list
 */
http.createServer((req, res) => {
    const url = new URL("http://localhost"+req.url);
    if (url.pathname === "/serverlist") {
        let filter = url.searchParams.get("filter");
        // console.log(`FSTR: ${filter}`);
        if (filter) {
            filter = parseFilter(filter);
            if (!checkFilter(filter)) {
                res.writeHead(422).end();
                return;
            }
        }
        res.writeHead(200, {"content-type":"application/json"});
        res.end(formatServerList((Number(url.searchParams.get("page")) || 1) - 1, filter));
        return;
    }
    if (url.pathname === "/bots") {
        res.writeHead(200, {"content-type":"application/json"});
        res.end(JSON.stringify(TTBot.index));
        return;
    }
    res.writeHead(404).end("bad path");
}).listen(settings.DATAPORT);

/**
 * @typedef FilterObj
 * @type {{full:boolean,spectate:boolean,capacity:number|[number,number],phase:"wait"|"play"|"over",topo:[string|number|[number,number]][]}}
 */

/**
 * @param {string} filter
 * @returns {FilterObj}
 */
function parseFilter(filter) {
    if (!filter) return true;
    let f = {};
    filter.split(";").map(sf => sf.split(":").map(
        (v, i, a) => i===0?v:(
            (a[0]==="full"||a[0]==="spectate")?v==="true"
            :(a[0]==="phase"?v
            :(a[0]==="capacity"?(v.includes(",")?v.split(",").map(w=>Number(w)):Number(v))
            :(v.split(",").map(w => w.split(".").map((x, j) =>
                j===0?x
                :(x.includes("q")?x.split("q").map(y => Number(y)):Number(x))))))))
    )).forEach(v => f[v[0]]=v[1]);
    return f;
}

/**
 * @param {GameInfo} v
 * @param {FilterObj} filter
 * @returns {boolean}
 */
function doFilter(v, filter) {
    if (filter === true) return true;
    // console.log(v);
    for (const field in filter) {
        switch (field) {
            case "full":if((v.playing===v.capacity)!==filter.full)return false;break;
            case "spectate":if(v.can_spectate!==filter.spectate)return false;break;
            case "phase":if(v.phase!==filter.phase)return false;break;
            case "capacity":if(typeof filter.capacity === "number"){if(v.capacity!==filter.capacity)return false;}else if(v.capacity < filter.capacity[0] || v.capacity > filter.capacity[1])return false;break;
            case "topo":
                if (!filter.topo.some(t =>
                    t[0] === v.dbase&&(t.length === 1?true
                    :t.slice(1).every((w, i) =>
                        typeof w === "number"?v.dparams[i]===w
                        :(v.dparams[i]>=w[0]&&v.dparams[i]<=w[1])
                    ))
                ))return false;break;
            default:break;
        }
    }
    return true;
}

/**
 * @param {number} page
 * @param {FilterObj} filter
 * @returns {string}
 */
function formatServerList(page, filter) {
    // filter = parseFilter(filter);
    // console.log("filter");
    // console.log(filter);
    const arr = Object.entries(gameInfo).filter(v => v[1] !== null).filter(v => v[1].public).sort((a, b) => Number(a[1].sort_key - b[1].sort_key)).filter(v => doFilter(v[1], filter));
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
            can_spectate:v[1].can_spectate,
            phase:v[1].phase
        };
    }));
}

if (!process.argv.includes("--no-in"))
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
