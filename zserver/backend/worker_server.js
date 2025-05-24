const http = require("http");
const fs = require("fs");
const path = require("path");
const ws = require("ws");
const { settings, validateJSONScheme, JSONScheme } = require("../../defs.js");
const { PerformanceError } = require("./errors.js");

const wss = new ws.Server({noServer: true});

let CONNECTION_COUNT = 0;
let MAX_TURN = 0;
let COMPLEXITY = 0;

process.on("message", (req, socket) => {
    if (req.hid !== undefined) {
        const url = new URL("localhost"+req.url);
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
        wss.handleUpgrade(req, socket, [], (sock) => {});
    }
});
