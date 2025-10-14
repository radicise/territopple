const http = require("http");
const fs = require("fs");
const path = require("path");
const DEFS = require("../../defs.js");
const { codeChars, settings, validateJSONScheme, JSONScheme, ensureFile, addLog, logStamp } = DEFS;
const mdb = require("mongodb");

fs.writeFileSync(path.join(process.env.HOME, "serv-pids", "puzs.pid"), process.pid.toString());

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

/**
 * @typedef {{filename:string,variants:number,has:number,players:number,dims:number[],author:string,name:string,__special_priority:number,topology:number|null,description:string}} FilterRecord
 */

(async()=>{
    const version0 = (await import("../../www/helpers/comparse/puzzle.mjs")).version0;
    process.on("SIGUSR1", async () => {
        /**@type {FilterRecord[]} */
        const index = [];
        await Promise.allSettled(fs.readdirSync(path.join(DEFS.__dname, "puzzles")).map((n) => {
            return new Promise(resolve => {
                console.log(n);
                if (!n.endsWith(".tpzl")) return resolve();
                fs.readFile(path.join(DEFS.__dname, "puzzles", n), (err, data) => {
                    console.log(err);
                    if (err) return resolve();
                    const info = version0(data);
                    let goals = 0;
                    for (const vari of info.variants) {
                        goals |= (1<<vari.GOAL_ID);
                        if (goals === 15) break;
                    }
                    index.push({filename:n.substring(0, n.length-5),variants:info.VC,has:goals,players:info.PC,dims:info.TPARAMS,author:info.author,name:info.name,topology:info.topology_rules.id??-1,description:info.info_str});
                    resolve();
                });
            });
        }));
        // const resp = await collection.bulkWrite(index.map(v => {return {replaceOne:{filter:{filename:v.filename,__special_priority:{$exists:false}},replacement:v,upsert:true}};}));
        const resp = await collection.bulkWrite(index.map(v => {return {insertOne:{document:v}};}));
        addLog(INDEXLOG, `INDEXED\nupdated: ${resp.modifiedCount}\ninserted: ${resp.insertedCount}\nupserted: ${resp.upsertedCount}\nerrors: ${resp.getWriteErrors().length}\n`);
    });
    const server = http.createServer(async (req, res) => {
        const url = new URL("http://localhost"+req.url);
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
                    default: {
                        res.writeHead(404).end();
                        return;
                    }
                }
            }
            case "POST": {
                res.writeHead(503).end();
                if (true) return;
                const puz = url.pathname.substring(4);
                const puzpath = path.join(DEFS.__dname, "puzzles", `${puz}.tpzl`);
                if (!puz || !fs.existsSync(puzpath)) return res.writeHead(404).end();
                const body = await new Promise((r, s) => {
                    let d = "";
                    req.on("data", (data) => {d += data});
                    req.on("end", ()=>r(d));
                    req.on("error", s);
                });
                return;
            }
        }
    });
    
    addLog(INFOLOG, `listening on port ${settings.PUZZLEPORT}`);
    server.listen(settings.PUZZLEPORT);
})();
