// code here adapted from an answer (https://stackoverflow.com/a/26354478) on StackOverflow by user "B T" (https://stackoverflow.com/users/122422/b-t)

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
// const { pipeline } = require("stream/promises");

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), {encoding:"utf-8"}));
{
    const extend = (e, o) => {
        for (const key in o) {
            if (typeof o[key] === 'object') {
                if (key in e) {
                    extend(e[key], o[key]);
                } else {
                    extend(e, o[key]);
                }
            } else {
                e[key] = o[key];
            }
        }
    };
    const prefs = JSON.parse(fs.readFileSync(path.join(__dirname, "prefs.json"), {encoding:"utf-8"}));
    extend(settings, prefs);
    // for (const pref in prefs) {
    //     settings[pref] = prefs[pref];
    // }
}

// const contentDir = __dirname+"/www";
const contentDir = settings.WEBCONTENT_DIR;
// const port = 9615;
const port = settings.WEBPORT;

const urlmap = settings.URL_MAP;
const urlmapgroups = settings.URL_MAP_GROUPS;
const devopts = settings.DEVOPTS;

/**
 * @param {string} urlpath
 * @returns {string}
 */
function getFilePath(urlpath) {
    const raw = path.normalize(urlpath);
    for (const matchstr in urlmap) {
        if (matchstr.includes("?")) { // has a map group
            let parts = matchstr.split("?"); // every other element is a map group
            for (let i = 1; i < parts.length; i += 2) {
                /**@type {string[]} */
                const group = urlmapgroups[parts[i]];
                parts[i] = "("+group.map(v => v.replaceAll(".", "\\.").replaceAll("`", ".")).join("|")+")";
            }
            let regex = parts.join("");
            const pat = new RegExp(regex);
            const results = pat.exec(raw);
            if (devopts.expr_webpath) console.log(results);
            if (results?.length) {
                /**@type {string[]} */
                let mparts = urlmap[matchstr].split("?");
                for (let i = 1; i < mparts.length; i += 2) {
                    mparts[i] = results[mparts[i]];
                }
                return mparts.join("");
            }
            // console.log(regex, pat.test(raw));
            // return raw;
        }
        if (urlpath === matchstr) { // simple replace
            return urlmap[matchstr];
        }
    }
    return raw;
}

http.createServer((request, response) => {
    try {
        const reqpath = url.parse(request.url).pathname;
        // const fpath = contentDir+(devopts.expr_webpath ? getFilePath(reqpath) : path.normalize((url.parse(request.url).pathname)));
        const fpath = contentDir+getFilePath(reqpath);
        if (devopts.expr_webpath) console.log(`${reqpath} resolved as ${fpath}`);
        fs.access(fpath, fs.constants.F_OK, (err) => {
            if (err) {
                response.writeHead(404);
                response.end();
            } else {
                try {
                    if (fs.lstatSync(fpath).isDirectory()) throw new Error();
                    const fileStream = fs.createReadStream(fpath);
                    if (fpath.endsWith(".js")) {
                        response.setHeader("Content-Type", "text/javascript");
                    }
                    fileStream.pipe(response);
                } catch (e) {
                    response.writeHead(400);
                    response.end();
                }
                // fileStream.on('open', function() {
                //     response.writeHead(200);
                //     response.end();
                // });
            }
        });
        // const fileStream = fs.createReadStream(getFilePath(url.parse(request.url).pathname));
        // const fileStream = fs.createReadStream(contentDir+path.normalize((url.parse(request.url).pathname)));
        // if (fpath.endsWith(".js")) {
        //     response.setHeader("Content-Type", "text/javascript");
        // }
        // const fileStream = fs.createReadStream(fpath);
        // fileStream.on('open', function() {
        //     response.writeHead(200);
        //     fileStream.pipe(response, {end:false});
        //     // response.end();
        // });
        // fileStream.on('error',function(e) {
        //     response.writeHead(404);
        //     response.end();
        // });
    } catch(e) {
        response.writeHead(500);
        response.end();
        console.log(e.stack);
    }
}).listen(port);
