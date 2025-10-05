const http = require("http");
const fs = require("fs");
const path = require("path");
const DEFS = require("../../defs.js");
const { codeChars, settings, validateJSONScheme, JSONScheme, ensureFile, addLog, logStamp } = DEFS;

if (!fs.existsSync("www/puzs")) {
    fs.symlinkSync(path.join(DEFS.__dname, "puzzles"), path.join(DEFS.__dname, "www", "puzs"));
}

const server = http.createServer((req, res) => {
    const url = new URL("http://localhost"+req.url);
    switch (req.method) {
        case "GET": {
            switch (url.pathname) {
                case "/puz/list": {
                    res.writeHead(503).end();
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
            return;
        }
    }
});

server.listen(settings.PUZZLEPORT);
