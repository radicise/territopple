const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { codeChars, settings, validateJSONScheme, JSONScheme } = require("../../defs.js");
const { PerformanceError } = require("./errors.js");

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
    "playing?": "number",
    "spectating?": "number"
};

/**
 * local only server
 * coordinates cross-process data
 */
http.createServer((req, res) => {
    const url = new URL("localhost"+req.url);
    switch (req.method) {
        case "GET":{
            switch (url.pathname) {
                case "/room-id":{
                    try {
                        const code = generateRoomCode();
                        gameInfo[code] = null;
                        res.writeHead(200);
                        res.end(code);
                    } catch {
                        res.writeHead(503);
                        res.end("code generation taking too long");
                    }
                    return;
                }
                case "/worker":{
                    const id = url.searchParams.get("id");
                    if (id === null || !(id in gameInfo) || gameInfo[id] === null) {
                        res.writeHead(404).end();
                        return;
                    }
                    res.writeHead(200);
                    res.end(gameInfo[id].worker.toString());
                    return;
                }
                default:{
                    res.writeHead(400).end();
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
                        return;
                    }
                    delete gameInfo[id];
                    res.writeHead(200).end();
                    return;
                }
                case "/worker":{
                    const id = Number(url.searchParams.get("id")) || null;
                    if (id === null) {
                        res.writeHead(404).end();
                        return;
                    }
                    Object.keys(gameInfo).filter(v => gameInfo[v].worker === id).forEach(v => {delete gameInfo[v];});
                    res.writeHead(200).end();
                    return;
                }
                default:{
                    res.writeHead(400).end();
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
                        return;
                    }
                    if (gameInfo[id] !== null) {
                        res.writeHead(403).end();
                        return;
                    }
                    let data = "";
                    req.on("data", (chunk) => {data += chunk;});
                    req.on("end", () => {
                        data = JSON.parse(data);
                        if (!validateJSONScheme(data, roomCreateScheme)) {
                            res.writeHead(422).end();
                            return;
                        }
                        data.playing = data.playing ?? 0;
                        data.spectating = data.spectating ?? 0;
                        data.sort_key = GAME_COUNTER;
                        GAME_COUNTER ++;
                        gameInfo[id] = data;
                        res.writeHead(200).end();
                    });
                    return;
                }
                default:{
                    res.writeHead(400).end();
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
    const url = new URL("localhost"+req.url);
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
    const arr = Object.entries(gameInfo).filter(v => v[1].public).sort((a, b) => Number(a[1].sort_key - b[1].sort_key));
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
