const http = require("http");
const { SessionManager, extractSessionId } = require("../sessions.js");
const { collection, getEffectivePrivs } = require("../db.js");
const { EREJECT, ACC_PUB_PREFIX } = require("../constants.js");

/**
 * processes the unsecured public data fetch operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function processPubFetch(req, res, url, log) {
    if (url.pathname === "/acc/pub/logout") {
        SessionManager.deleteToken(extractSessionId(req.headers.cookie));
        res.writeHead(200).end();
        // res.writeHead(200,{"Set-Cookie":"sessionId=none; Secure; Same-Site=Lax; Http-Only; Path='/'"}).end();
        return;
    }
    if (url.pathname === "/acc/pub/logged-in") {
        if (SessionManager.getAccountId(extractSessionId(req.headers.cookie))) {
            res.writeHead(200).end();
        } else {
            res.writeHead(400).end();
        }
        return;
    }
    //https://territopple.net/acc/pub/list?page=${page||1}&search=${search??"*"}
    if (url.pathname === "/acc/pub/list") {
        const accid = SessionManager.getAccountId(extractSessionId(req.headers.cookie));
        try {
            const search = url.searchParams.get("search") || ".*";
            const page = Number(url.searchParams.get("page")) || 1;
            let pipeline = collection.find().limit(20);
            if (search !== ".*") {
                pipeline = pipeline.filter({$or:[{id:{$regex:search}},{name:{$regex:search}}]});
            }
            pipeline = pipeline.sort({_id:1});
            const list = await (pipeline.skip(20*(page-1)).project({id:1,name:1,cdate:1,last_online:1,friends:1,level:1,incoming_friends:1,outgoing_friends:1,flagf1:1})).toArray();
            if (accid) {
                for (let i = 0; i < list.length; i ++) {
                    list[i].friend = list[i].id===accid?5:(list[i].friends?.includes(accid)?3:(list[i].outgoing_friends?.includes(accid)?2:(list[i].incoming_friends?.includes(accid)?1:0)));
                }
            }
            for (let i = 0; i < list.length; i ++) {
                delete list[i]["friends"];
                delete list[i]["incoming_friends"];
                delete list[i]["outgoing_friends"];
                list[i].odate = list[i].last_online;
                delete list[i]["last_online"];
            }
            res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(list));
        } catch (E) {
            console.log(E);
            res.writeHead(500).end(E.sanitized ?? "Internal Error");
        }
        return;
    }
    /**@type {(op:string)=>void} */
    const notimpl = (op)=>{log(EREJECT, `${op} not implemented`);};
    const stripped = url.pathname.substring(ACC_PUB_PREFIX.length); // strip the public data path prefix
    let target = stripped.substring(1, stripped.indexOf("/", 1));
    // let self = false;
    // if (target === "%40self") {
    //     self = true;
    //     const p = req.headers.cookie.indexOf("sessionId");
    //     if (p === -1) {
    //         res.writeHead(403).end();
    //         return;
    //     }
    //     const e = req.headers.cookie.indexOf(";", p+10);
    //     console.log(req.headers.cookie.substring(p+10, e>0?e:undefined));
    //     target = SessionManager.getAccountId(req.headers.cookie.substring(p+10, e>0?e:undefined));
    //     if (!target) {
    //         res.writeHead(403).end();
    //         return;
    //     }
    // }
    let self = false;
    let rid;
    if (req.headers.cookie) {
        let p = req.headers.cookie.indexOf("; sessionId");
        if (p === -1) {
            if (req.headers.cookie.startsWith("sessionId")) {
                p = 0;
            }
        } else {
            p += 2;
        }
        if (p === -1 && target === "%40self") {
            res.writeHead(403).end("bad cookie");
            return;
        }
        const e = req.headers.cookie.indexOf(";", p+10);
        const me = SessionManager.getAccountId(req.headers.cookie.substring(p+10, e>0?e:undefined));
        rid = me;
        if (target === "%40self") {
            if (!me) {
                res.writeHead(403).end("bad token");
                return;
            }
            target = me;
        }
        if (target === me) {
            self = true;
        }
    }
    const resource = stripped.substring(stripped.indexOf("/", 1));
    // console.log(`${target} , ${resource}`);
    switch (resource) {
        case "/sanction": {
            if (!self) {
                res.writeHead(403).end("can only see own sanctions");
                return;
            }
            try {
                /**@type {AccountRecord} */
                const v = await collection.findOne({id:target});
                v._id;
                const t = Date.now();
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify(v.sanction.filter(v=>!((v.expires<=t&&v.expires!==0)||v.sanction_id&0x20000000)).map(v=>{delete v["notes"];return v;})));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/perms": {
            if (!self) {
                res.writeHead(403).end("can only see own perms");
                return;
            }
            try {
                /**@type {AccountRecord} */
                const v = await collection.findOne({id:target});
                const t = Date.now();
                const p = await getEffectivePrivs(v);
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({p}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/info": {
            try {
                const v = await collection.findOne({id:target});
                v._id;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({id:target,name:v.name,email:self?v.email:undefined,cdate:v.cdate,last_online:v.last_online,level:v.level,sanction:null,rid,flagf1:v.flagf1??0}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/display-name":{
            try {
                const v = (await collection.findOne({id:target})).name;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({name:v}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        case "/solved":{
            try {
                const v = (await collection.findOne({id:target})).solved;
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({solved:v}));
            } catch (E) {
                console.log(E);
                res.writeHead(404).end();
            }
            return;
        }
        default:{
            // log(EERROR, "bad path");
            res.writeHead(404).end();
            return;
        }
    }
}

exports.processPubFetch = processPubFetch;
