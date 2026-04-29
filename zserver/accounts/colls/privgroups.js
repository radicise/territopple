const http = require("http");
const { ACC_ADMIN_PREFIX, ACC_ADMIN_PGRP_PREFIX } = require("../constants.js");
const { ASessionManager, extractASessionId } = require("../sessions.js");
const { AccountRecord, PrivGroupRecord } = require("../types.js");
const { collection, getEffectivePrivs, priv_groups, getAccountRecord, client, mdb } = require("../db.js");
const { check_permission, check_can_moderate, check_sanction_allowed, Permissions } = require("../perms.js");
const { validateJSONScheme } = require("../../../defs.js");
const schemes = require("../schemes.js");
const { getBody } = require("../common.js");

// /**
//  * @param {number} gid
//  */
// async function countPGrpMembers(gid) {
//     const buf = Buffer.alloc(4);
//     buf.writeInt32BE(gid);
//     buf[0] = buf[0] | 0x80;
//     return await collection.countDocuments({"$or":[{priv_groups:new mdb.Int32(gid)},{priv_groups:new mdb.Int32(buf.readInt32BE())}]});
// }

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
    const pagesize = Math.max(10,Math.min(url.searchParams.has("count")?Number(url.searchParams.get("count")):20,30));
    if (isNaN(pagesize)) {
        res.writeHead(400,{"content-type":"text/plain"}).end("malformed request (bad pagesize)");
        return;
    }
    let cursor;
    const filter = {"_special":null};
    if (url.searchParams.has("name")) {
        filter["$text"] = {$search:url.searchParams.get("name")};
        cursor = priv_groups.find(filter,{score:{$meta:"textScore"}}).sort({score:{$meta:"textScore"}});
    } else {
        cursor = priv_groups.find(filter).sort({_id:1});
    }
    const total = await priv_groups.countDocuments(filter);
    cursor.skip(pagesize*page);
    cursor.limit(pagesize);
    const data = await cursor.toArray();
    res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({total,pagesize,groups:data}));
}

/**
 * @param {string} body
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {AccountRecord} acr
 * @param {number} req_privs
 */
async function handlePGroupCreate(body, res, url, acr, req_privs) {
    if (!check_permission(req_privs, Permissions.PRIV_ADMIN)) {
        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
        return;
    }
    const data = JSON.parse(body);
    if (!validateJSONScheme(data, schemes.adminPGrpCreate)) {
        res.writeHead(422,{"content-type":"text/plain"}).end("invalid request data");
        return;
    }
    if (data.name.length === 0) {
        res.writeHead(400,{"content-type":"text/plain"}).end("must provide valid name");
        return;
    }
    if (data.flags === 0) {
        res.writeHead(400,{"content-type":"text/plain"}).end("must include at least one privilege");
        return;
    }
    if ((await priv_groups.findOne({"name":data.name})) !== null) {
        res.writeHead(422,{"content-type":"text/plain"}).end("a group with that name already exists");
        return;
    }
    const result = await priv_groups.findOneAndUpdate({"_special":"masterid"},{"$inc":{"counter":1}});
    if (result === null) {
        res.writeHead(500).end("master ID tracker gone, contact server operator");
        return;
    }
    await priv_groups.insertOne({gid:new mdb.Int32(result.counter),name:data.name,privs:mdb.Long.fromInt(data.flags),members:new mdb.Int32(0)});
    res.writeHead(201,{"content-type":"text/plain"}).end(`${result.counter}`);
    return;
}

/**
 * @param {string} body
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {AccountRecord} acr
 * @param {number} req_privs
 */
async function handlePGroupUpdate(body, res, url, acr, req_privs) {
    if (!check_permission(req_privs, Permissions.PRIV_ADMIN)) {
        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
        return;
    }
    const data = JSON.parse(body);
    if (!validateJSONScheme(data, schemes.adminPGrpUpdate)) {
        res.writeHead(422,{"content-type":"text/plain"}).end("invalid request data");
        return;
    }
    if (data.name.length === 0) {
        res.writeHead(400,{"content-type":"text/plain"}).end("must provide valid name");
        return;
    }
    if (data.flags === 0) {
        res.writeHead(400,{"content-type":"text/plain"}).end("must include at least one privilege");
        return;
    }
    const grp = await priv_groups.findOne({"gid":data.gid});
    if (grp === null) {
        res.writeHead(404,{"content-type":"text/plain"}).end("priv group not found");
        return;
    }
    if (grp.name !== data.name) {
        if ((await priv_groups.findOne({"name":data.name})) !== null) {
            res.writeHead(422,{"content-type":"text/plain"}).end("a group with that name already exists");
            return;
        }
    }
    if ((await priv_groups.updateOne({"gid":data.gid},{"$set":{name:data.name,privs:mdb.Long.fromInt(data.flags)}})).modifiedCount === 1) {
        res.writeHead(200,{"content-type":"text/plain"}).end("group updated successfully");
        return;
    }
    res.writeHead(500,{"content-type":"text/plain"}).end("error updating database entry");
    return;
}

/**
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {AccountRecord} acr
 * @param {number} req_privs
 */
async function handlePGroupDelete(res, url, acr, req_privs) {
    if (!check_permission(req_privs, Permissions.PRIV_ADMIN)) {
        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
        return;
    }
    const gid = Number(url.pathname.split("/")[5]);
    if (isNaN(gid)) {
        res.writeHead(400,{"content-type":"text/plain"}).end("invalid group id");
        return;
    }
    /**@type {PrivGroupRecord} */
    const grp = await priv_groups.findOne({gid});
    if (grp === null) {
        res.writeHead(404,{"content-type":"text/plain"}).end("group not found");
        return;
    }
    // const member_count = await countPGrpMembers(gid);
    if (grp.members > 0) {
        res.writeHead(501,{"content-type":"text/plain"}).end("handling deletion of groups with members not implemented");
        return;
    }
    if ((await priv_groups.deleteOne({gid})).deletedCount === 1) {
        res.writeHead(200,{"content-type":"text/plain"}).end(`deleted group '${grp.name}' (gid ${gid})`);
        return;
    }
    res.writeHead(500,{"content-type":"text/plain"}).end("unknown database error when attempting deletion");
    return
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
        switch (stripped.split("/",2).join("/")) {
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
            case "/update": { // /acc/admin/pgrp/update
                if (req.method !== "POST") {
                    res.writeHead(405,{"content-type":"text/plain"}).end("POST usage required");
                    return;
                }
                await handlePGroupUpdate(await getBody(req), res, url, acr, req_privs);
                return;
            }
            case "/delete": { // /acc/admin/pgrp/delete/{gid:number}
                if (req.method !== "DELETE") {
                    res.writeHead(405,{"content-type":"text/plain"}).end("DELETE usage required");
                    return;
                }
                await handlePGroupDelete(res, url, acr, req_privs);
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
