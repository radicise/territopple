const http = require("http");
const { ACC_ADMIN_PREFIX, ACC_ADMIN_PGRP_PREFIX } = require("../constants.js");
const { ASessionManager, extractASessionId } = require("../sessions.js");
const { AccountRecord, PrivGroupRecord } = require("../types.js");
const { collection, getEffectivePrivs, priv_groups, getAccountRecord, client, mdb } = require("../db.js");
const { check_permission, check_can_moderate, check_sanction_allowed, Permissions } = require("../perms.js");
const { validateJSONScheme } = require("../../../defs.js");
const schemes = require("../schemes.js");
const { getBody } = require("../common.js");

/**
 * @param {URL} url
 * @param {http.ServerResponse} res
 * @param {AccountRecord} acr
 * @param {number} req_privs
 */
async function handlePGroupList(url, res, acr, req_privs) {
    if (!check_permission(req_privs, Permissions.READ_PRIV_FLAGS, Permissions.PRIV_ADMIN, Permissions.APPLY_PRIV_GROUPS)) {
        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
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
}

/**
 * @param {string} body
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {AccountRecord} acr
 * @param {number} req_privs
 */
async function handlePGroupCreate(body, res, url, acr, req_privs) {
    if (!check_permission(req_privs, Permissions.PRIV_ADMIN, Permissions.APPLY_PRIV_GROUPS)) {
        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
        return;
    }
    const data = JSON.parse(body);
    if (!validateJSONScheme(data, schemes.adminPGrpCreate)) {
        res.writeHead(422,{"content-type":"text/plain"}).end("invalid request data");
        return;
    }
    const result = await priv_groups.findOneAndUpdate({"_special":"masterid"},{"$inc":{"counter":1}});
    if (result === null) {
        res.writeHead(500).end("master ID tracker gone, contact server operator");
        return;
    }
    await priv_groups.insertOne({gid:new mdb.Int32(result.counter),name:data.name,privs:mdb.Long.fromInt(data.flags)});
    res.writeHead(201,{"content-type":"text/plain"}).end(`${result.counter}`);
    return;
}

/**
 * processes privelege group operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function handlePGroupRequest(req, res, url, log) {
    try {
        const acr = await getAccountRecord(ASessionManager.getAccountId(extractASessionId(req.headers.cookie)));
        const req_privs = await getEffectivePrivs(acr);
        const stripped = url.pathname.substring(ACC_ADMIN_PGRP_PREFIX.length);
        switch (stripped) {
            case "/list": { // /acc/admin/pgrp/list?page={number}[&name={string}][&count={number}]
                if (req.method !== "GET") {
                    res.writeHead(405,{"content-type":"text/plain"}).end("GET usage required");
                    return;
                }
                await handlePGroupList(url, res, acr, req_privs);
                return;
            }
            case "/create": { // /acc/admin/pgrp/create
                if (req.method !== "POST") {
                    res.writeHead(405,{"content-type":"text/plain"}).end("POST usage required");
                    return;
                }
                await handlePGroupCreate(await getBody(req), res, url, acr, req_privs);
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
