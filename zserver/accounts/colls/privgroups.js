const http = require("http");
const { ACC_ADMIN_PREFIX, ACC_ADMIN_PGRP_PREFIX } = require("../constants.js");
const { ASessionManager, extractASessionId } = require("../sessions.js");
const { AccountRecord, PrivGroupRecord } = require("../types.js");
const { collection, getEffectivePrivs, priv_groups } = require("../db.js");
const { check_permission, check_can_moderate, check_sanction_allowed, Permissions } = require("../perms.js");
const { validateJSONScheme } = require("../../../defs.js");
const schemes = require("../schemes.js");


/**
 * processes privelege group operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function handlePGroupRequest(req, res, url, log) {
    try {
        const stripped = url.pathname.substring(ACC_ADMIN_PGRP_PREFIX.length);
        switch (stripped) {
            case "/list": { // /acc/admin/pgrp/list?page={number}[&name={string}][&count={number}]
                if (req.method !== "GET") {
                    res.writeHead(405,{"content-type":"text/plain"}).end("GET usage required");
                    return;
                }
                const page = Number(url.searchParams.get("page")??0) - 1;
                if (page < 0 || isNaN(page)) {
                    res.writeHead(400,{"content-type":"text/plain"}).end("malformed request (bad page)");
                    return;
                }
                const pagesize = url.searchParams.has("count")?Number(url.searchParams.get("count")):20;
                if (isNaN(pagesize)) {
                    res.writeHead(400,{"content-type":"text/plain"}).end("malformed request (bad pagesize)");
                    return;
                }
                let cursor;
                if (url.searchParams.has("name")) {
                    cursor = priv_groups.find({$text:{$search:url.searchParams.get("name")}},{score:{$meta:"textScore"}}).sort({score:{$meta:"textScore"}});
                } else {
                    cursor = priv_groups.find({}).sort({_id:1});
                }
                cursor.skip(pagesize*page);
                cursor.limit(pagesize);
                const data = await cursor.toArray();
                res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify(data));
                return;
            }
            default: {
                res.writeHead(404,{"content-type":"text/plain"}).end("endpoint does not exist");
                return;
            }
        }
    } catch (E) {
        console.log(E);
        res.writeHead(500,{"content-type":"text/plain"}).end("uncaught exception");
    }
}

exports.handlePGroupRequest = handlePGroupRequest;
