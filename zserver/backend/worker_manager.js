const http = require("http");
const fs = require("fs");
const path = require("path");
const ws = require("ws");
const child_process = require("child_process");
const socks = require("../socks/handlers.js");
const { settings, validateJSONScheme, JSONScheme, InvariantViolationError, emit, on, clear } = require("../../defs.js");
const { PerformanceError } = require("./errors.js");

socks.setGlobals({}, emit, on, clear);

/**
 * @typedef {{proc:child_process.ChildProcess,factor_update_notif:[Promise<void>, Function]|null,load_factors:{connections:number,complexity:number,turnaround:number}}} WorkerServer
 */

/**
 * @type {Record<number, WorkerServer>}
 */
const children = {};

/**
 * @type {Record<number, (value: any) => void>}
 */
const handoff_waits = {};

let HANDOFF_COUNTER = 0;

let WORKER_COUNTER = 0;

/**
 * creates a new worker server instance
 * throws an InvariantViolationError if the max number of workers would be exceeded
 * @throws {InvariantViolationError}
 * @returns {WorkerServer}
 */
function instanceWorker() {
    if (Object.keys(children).length === settings.WORKERS.LIMIT) {
        throw new InvariantViolationError("Cannot Instance Worker, Worker Limit Reached");
    }
    const c = WORKER_COUNTER;
    WORKER_COUNTER ++;
    const child = child_process.fork(__dirname+"/worker_server.js", process.argv.includes("--eval-stdin")?["--debug"]:[]);
    child.send(c);
    let inactivate = false;
    child.on("error", () => {
        if (inactivate) return;
        inactivate = true;
        if (c in children) delete children[c];
        http.request(`http://localhost:${settings.INTERNALPORT}/worker?id=${c}`, {method: "DELETE"}).end();
    });
    child.on("exit", () => {
        if (inactivate) return;
        inactivate = true;
        if (c in children) delete children[c];
        http.request(`http://localhost:${settings.INTERNALPORT}/worker?id=${c}`, {method: "DELETE"}).end();
    });
    child.on("message", (msg) => {
        if (msg.factor_update !== undefined) {
            for (const k in msg.factor_update) {
                children[c].load_factors[k] = msg.factor_update[k];
            }
            if (children[c].factor_update_notif !== null) {
                const f = children[c].factor_update_notif[1];
                children[c].factor_update_notif = null;
                f();
            }
        } else if (msg.hid !== undefined) {
            const f = handoff_waits[msg.hid];
            delete handoff_waits[msg.hid];
            f(msg.v);
        }
    });
    children[c] = {proc:child, factor_update_notif:null, load_factors:{connections:0, complexity:0, turnaround:0}};
    return children[c];
}

const HALF_MAX_TURN = settings.WORKERS.MAX_TURNAROUND / 2;

/**
 * selects a worker server with the given capacity, servers with low load levels will be preferred
 * creates a server if none are able to meet the capacity requirement
 * throws an InvariantViolationError if the max number of workers would be exceeded
 * @throws {InvariantViolationError}
 * @returns {WorkerServer}
 */
function selectWorker(capacity) {
    // for (const worker in children) {
    //     const data = children[worker];
    // }
    // absolute minimum in terms of capacity available
    const elig = Object.values(children).filter(v => v.load_factors.connections+capacity <= settings.WORKERS.MAX_CONNECTIONS).filter(v => v.load_factors.turnaround <= settings.WORKERS.MAX_TURNAROUND);
    if (elig.length === 0) {
        return instanceWorker();
    }
    // prefer servers that have healthy request turnaround times
    const pref = elig.filter(v => v.load_factors.turnaround <= HALF_MAX_TURN);
    return (pref.length > 0 ? pref : elig).sort((a, b) => a.load_factors.complexity - b.load_factors.complexity)[0];
}

const server = http.createServer();
const wss = new ws.Server({noServer: true});

function connErr(request, socket, args) {
    wss.handleUpgrade(request, socket, [], (sock) => {
        socks.handle("error", sock, args, {});
    });
}

/**
 * handles the handoff of a socket with a room creation connection type
 * @param {number} capacity
 * @param {http.IncomingMessage} req
 * @param {import("stream").Duplex} socket
 */
async function handlePass(capacity, req, socket) {
    while (true) {
        try {
            const worker = selectWorker(capacity);
            if (worker.factor_update_notif !== null) {
                await worker.factor_update_notif[0];
                continue;
            }
            const handoff_id = HANDOFF_COUNTER;
            HANDOFF_COUNTER ++;
            if (HANDOFF_COUNTER >= 65500) {
                HANDOFF_COUNTER = 0;
            }
            const resp = await new Promise(r => {handoff_waits[handoff_id] = r;worker.proc.send({hid:handoff_id, headers:req.headers, method:req.method, url: req.url}, socket)});
            if (!resp) {
                if (worker.factor_update_notif === null) {
                    const p = new Promise(r => {worker.factor_update_notif = [p, r];});
                }
                await worker.factor_update_notif[0];
                continue;
            }
            return;
        } catch {
            connErr(req, socket, {data:"Servers Are Unable To Process That Request At This Time",redirect:"/play-online",store:"Servers Are Unable To Process That Request At This Time"});
            return;
        }
    }
}

server.on("upgrade", (req, socket) => {
    const url = new URL("http://localhost"+req.url);
    const connType = Number(url.searchParams.get("t"));
    if (Number.isNaN(connType) || connType < 0 || connType > 5) {
        connErr(req, socket, {data:"Connection Type Missing",redirect:"/play-online",store:"Connection Type Missing"});
        return;
    }
    if (connType > 0 && connType < 3) {
        const capacity = Number(url.searchParams.get("p"));
        if (isNaN(capacity)) {
            connErr(req, socket, {data:"Bad Player Count",redirect:"/play-online",store:"Bad Player Count"});
            return;
        }
        handlePass(capacity, req, socket);
        return;
    }
    const id = url.searchParams.get("g");
    if (id === null) {
        connErr(req, socket, {data:"Missing Game ID",redirect:"/play-online",store:"Missing Game ID"});
        return;
    }
    http.get(`http://localhost:${settings.INTERNALPORT}/worker?id=${id}`, (res) => {
        /**@type {number} */
        let data = "";
        res.on("data", (chunk) => {data += chunk;});
        res.on("end", () => {
            data = Number(data);
            if (!(data in children)) {
                connErr(req, socket, {data:"Internal Failure",redirect:"/play-online",store:"Internal Failure"});
                return;
            }
            children[data].proc.send({headers: req.headers, method: req.method, url: req.url}, socket);
        });
    });
});

server.listen(settings.GAMEPORT);

function immExit() {
    for (const id in children) {
        children[id].proc.kill("SIGKILL");
    }
    server.close();
    server.closeAllConnections();
    process.exit();
}

process.on("SIGINT", immExit);

let selChild = null;

if (!process.argv.includes("--no-in"))
process.stdin.on("data", (d) => {
    const l = d.toString("utf-8");
    const parts = l.split(/:|;/).map(v => v.trim());
    const uparts = parts.map(v => v.toUpperCase());
    const p1 = uparts[0];
    switch (p1) {
        case "CHILD":{
            if (parts.length < 2) {
                console.log("MALFORMED");
                return;
            }
            if (uparts[1] === "SEL") {
                if (parts.length < 3 || uparts[2] === "NULL") {
                    selChild = null;
                    return;
                }
                if (Number(parts[2]) in children) {
                    selChild = Number(parts[2]);
                } else {
                    console.log("BAD CHILD NUM");
                }
                return;
            }
            if (Number(parts[1]) in children) {
                children[Number(parts[1])].proc.send({cmd:l.slice(p1.length+parts[1].length+2)});
            } else {
                console.log("BAD CHILD NUM");
            }
            return;
        }
        case "UPDATE":{
            selChild = null;
            Object.entries(children).forEach(([s, v]) => {delete children[s];v.proc.kill();});
            instanceWorker();
            return;
        }
        default:{
            if (process.argv.includes("--eval-stdin")) {
                if (selChild !== null) {
                    if (!(selChild in children)) {
                        selChild = null;
                        console.log("SELECTED CHILD EXITED");
                        return;
                    }
                    children[selChild].proc.send({cmd:l});
                    return;
                }
                try {
                    console.log(eval(l));
                } catch (E) {
                    console.error(E.stack);
                }
            } else {
                console.error("UNRECOGNIZED COMMAND");
            }
            return;
        }
    }
});
