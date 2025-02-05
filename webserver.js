// code here adapted from an answer (https://stackoverflow.com/a/26354478) on StackOverflow by user "B T" (https://stackoverflow.com/users/122422/b-t)

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
// const { pipeline } = require("stream/promises");

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), {encoding:"utf-8"}));

// const contentDir = __dirname+"/www";
const contentDir = settings.WEBCONTENT_DIR;
// const port = 9615;
const port = settings.WEBPORT;

const urlmap = settings.URL_MAP;
const urlmapgroups = settings.URL_MAP_GROUPS;

/**
 * @param {string} urlpath
 * @returns {string}
 */
function getFilePath(urlpath) {
    const raw = contentDir+path.normalize(urlpath);
    for (const matchstr in urlmap) {
        if (urlpath === matchstr) {
            //
        }
    }
    return raw;
}

http.createServer((request, response) => {
    try {
        const fileStream = fs.createReadStream(getFilePath(url.parse(request.url).pathname));
        fileStream.pipe(response);
        fileStream.on('open', function() {
            response.writeHead(200);
        });
        fileStream.on('error',function(e) {
            response.writeHead(404);
            response.end();
        });
    } catch(e) {
        response.writeHead(500);
        response.end();
        console.log(e.stack);
    }
}).listen(port);
