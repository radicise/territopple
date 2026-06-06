const http = require("http");
const { ACC_ADMIN_PREFIX, EERROR, EBADMOD, ACC_ADMIN_PGRP_PREFIX } = require("../constants.js");
const { ASessionManager, extractASessionId, makeASessionCookie } = require("../sessions.js");
const { AccountRecord, PrivGroupRecord, SanctionRecord } = require("../types.js");
const { collection, priv_groups, getEffectivePrivs, getAccountRecord, achi_data, acts_data } = require("../db.js");
const { check_permission, check_can_moderate, check_sanction_allowed, Permissions, check_raw_permissions } = require("../perms.js");
const { validateJSONScheme, settings } = require("../../../defs.js");
const schemes = require("../schemes.js");
const auth = require("../auth.js");
const { handlePGroupRequest } = require("../colls/privgroups.js");
const { triggerManual, getRequiredPermissions, getAchievements, getActions, bulkAchiWrite } = require("../achi/primary.js");

/**@typedef {{acc:string,refid:number,cancel?:boolean,value?:number,expires?:number,notes?:string,appeal?:{accept:boolean,notes?:string,value?:number}}} AdminSancManData */

/**
 * processes the admin fetch operations
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {(p:string,d:string)=>void} log
 */
async function processAdminFetch(req, res, url, log) {
    const stripped = url.pathname.substring(ACC_ADMIN_PREFIX.length);
    if (stripped === "/logout") {
        ASessionManager.deleteToken(extractASessionId(req.headers.cookie));
        res.writeHead(200).end();
        return;
    }
    if (stripped === "/check") {
        const id = ASessionManager.getAccountId(extractASessionId(req.headers.cookie));
        if (id) {
            res.writeHead(200).end(JSON.stringify({name:id}));
        } else {
            res.writeHead(400).end();
        }
        return;
    }
    if (url.pathname.startsWith(ACC_ADMIN_PGRP_PREFIX)) {
        const sessid = extractASessionId(req.headers.cookie);
        const accid = ASessionManager.getAccountId(sessid);
        if (!sessid || !accid) {
            res.writeHead(403).end("not logged in");
            return;
        }
        handlePGroupRequest(req, res, url, log);
        return;
    }
    if ((req.headers["content-type"] !== "application/json" || req.headers["sec-fetch-site"] !== "same-origin") && req.method !== "GET") {
        res.writeHead(400).end();
        return;
    }
    const body = req.method === "GET"?"":await new Promise((r, s) => {
        let d = "";
        req.on("data", (data) => {d += data});
        req.on("end", ()=>r(d));
        req.on("error", s);
    });
    if (stripped === "/login") {
        const data = JSON.parse(body);
        if (!validateJSONScheme(data, schemes.accLoginScheme)) {
            res.writeHead(422).end();
            return;
        }
        try {
            /**@type {AccountRecord} */
            const doc = await collection.findOne({id:data.id});
            if (doc === null) {
                res.writeHead(404).end();
                return;
            }
            const privs = await getEffectivePrivs(doc);
            if (!check_permission(privs, Permissions.MODERATE, Permissions.TRUSTED)) {
                res.writeHead(403).end("account is not an admin");
                return;
            }
            if (auth.verifyRecordPassword(doc.pwdata.buffer, data.pw)) {
                // res.writeHead(200, {"Set-Cookie":`sessionId=${SessionManager.createSession(data.id)}; Same-Site=Lax; Secure; HttpOnly; Path=/`}).end();
                res.writeHead(200, {"Set-Cookie":makeASessionCookie(ASessionManager.createSession(data.id))}).end();
                ASessionManager.setCachedPerms(data.id, privs);
                return;
            } else {
                res.writeHead(403).end();
                return;
            }
        } catch (E) {
            log(EERROR, E.toString()+`\n${E.stack}`);
            res.writeHead(500).end();
            return;
        }
    }
    const sessid = extractASessionId(req.headers.cookie);
    const accid = ASessionManager.getAccountId(sessid);
    if (!sessid || !accid) {
        res.writeHead(403).end("not logged in");
        return;
    }
    const adminperms = ASessionManager.getCachedPerms(accid);
    switch (req.method) {
        case "GET":{
            switch (stripped) {
                case "/priv-group-info": {
                    if (!check_permission(adminperms, Permissions.READ_PRIV_FLAGS)) {
                        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
                        return;
                    }
                    const target = Number(url.searchParams.get("id"));
                    if (isNaN(target)) {
                        res.writeHead(400).end("no target");
                        return;
                    }
                    try {
                        /**@type {PrivGroupRecord} */
                        const rec = await priv_groups.findOne({gid:target});
                        if (!rec) {
                            res.writeHead(404).end("target not found");
                            return;
                        }
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(rec));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                case "/info": {
                    const target = url.searchParams.get("id");
                    if (!target) {
                        res.writeHead(400).end("no target");
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const rec = await collection.findOne({id:target});
                        if (!rec) {
                            res.writeHead(404).end("target not found");
                            return;
                        }
                        delete rec["pwdata"];
                        delete rec["next_refid"];
                        if (!check_permission(adminperms, Permissions.READ_PRIV_FLAGS, Permissions.MODERATE)) {
                            delete rec["priv_groups"];
                            delete rec["priv_level"];
                        }
                        if (!check_permission(adminperms, Permissions.MODERATE)) {
                            delete rec["sanction"];
                        }
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(rec));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                case "/privs": {
                    // const id = ASessionManager.getAccountId(extractASessionId(req.headers.cookie));
                    try {
                        // const rec = await getAccountRecord(id);
                        // const privs = await getEffectivePrivs(rec);
                        // res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify({privs}));
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify({privs:adminperms}));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                case "/achievements": {
                    if (!check_permission(adminperms, Permissions.TRUSTED, Permissions.MANAGE_ACHIEVEMENTS)) {
                        res.writeHead(403, {"content-type":"text/plain"}).end("insufficient permissions");
                        return;
                    }
                    const batch_size = Number(url.searchParams.get("count")) || settings.ADMIN.DEFAULT_BATCH_SIZE;
                    try {
                        const kind = url.searchParams.get("kind") ?? "achi";
                        const search = url.searchParams.get("search") || ".*";
                        const page = Number(url.searchParams.get("page")) || 1;
                        let coll;
                        let ff;
                        switch (kind) {
                            case "achi": {
                                coll = achi_data;
                                ff = "name";
                                break;
                            }
                            case "acts": {
                                coll = acts_data;
                                ff = "id";
                                break;
                            }
                            default: {
                                res.writeHead(400,{"content-type":"text/plain"}).end("bad kind");
                                return;
                            }
                        }
                        // console.log(`k: ${kind}\ns: ${search}\np: ${page}`);
                        let pipeline = coll.find().limit(batch_size);
                        let filter = {};
                        if (search !== ".*") {
                            filter[ff] = {$regex:search};
                            pipeline = pipeline.filter(filter);
                        }
                        pipeline = pipeline.sort({_id:1});
                        const [count, list] = await Promise.all([coll.countDocuments(filter),pipeline.skip(batch_size*(page-1)).project({_id:0}).toArray()]);
                        // const list = await (pipeline.skip(batch_size*(page-1)).project({_id:0})).toArray();
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify({count:Math.ceil(count/batch_size),list}));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500,{"content-type":"text/plain"}).end(E.sanitized??"internal error");
                    }
                    return;
                }
            }
            res.writeHead(404).end();
            return;
        }
        case "POST":{
            switch (stripped) {
                case "/achi-source": {
                    if (!check_permission(adminperms, Permissions.MANAGE_ACHIEVEMENTS)) {
                        res.writeHead(403, {"content-type":"text/plain"}).end("insufficient permissions");
                        return;
                    }
                    const data = JSON.parse(body);
                    for (const k of ["acts","achi"]) {
                        for (const sk of ["create","update","delete"]) {
                            if (!data[k] || !Array.isArray(data[k][sk])) {
                                res.writeHead(400, {"content-type":"text/plain"}).end("invalid update to achi source");
                                return;
                            }
                        }
                    }
                    try {
                        const result = await bulkAchiWrite(data);
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(result));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500, {"content-type":"text/plain"}).end(E.sanitized??"internal error");
                    }
                    return;
                }
                case "/achi-trigger": {
                    if (!(
                        check_permission(adminperms, Permissions.MANAGE_ACHIEVEMENTS)
                        && check_permission(adminperms, Permissions.MODERATE)
                    )) {}
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, schemes.adminAchieve)) {
                        res.writeHead(400,{"content-type":"text/plain"}).end("misformed");
                        return;
                    }
                    try {
                        const mod_a = await getAccountRecord(accid);
                        if (!mod_a) {
                            res.writeHead(404,{"content-type":"text/plain"}).end("admin account not found");
                            return;
                        }
                        if (!check_raw_permissions(adminperms, ...(await getRequiredPermissions(data.action)))) {
                            res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
                            return;
                        }
                        const acr = await getAccountRecord(data.accid);
                        const result = await triggerManual(acr, data.action, data.discrim);
                        const sets = {};
                        for (const achi of result.granted) {
                            sets[achi.id] = achi.data;
                        }
                        for (const achi of result.mutated) {
                            sets[achi.id] = achi.data;
                        }
                        if ((await collection.updateOne({id:data.accid},{$set:sets})).modifiedCount !== 1) {
                            res.writeHead(500).end();
                            return;
                        }
                        res.writeHead(200).end();
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500,{"content-type":"text/plain"}).end("internal error");
                    }
                    return;
                }
                // normal sanction
                case "/Nsanction": {
                    if (!check_permission(adminperms, Permissions.MODERATE)) {
                        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
                        return;
                    }
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, schemes.sanctionScheme)) {
                        res.writeHead(400).end("misformed");
                        return;
                    }
                    try {
                        /**@type {AccountRecord} */
                        const source_rec = await collection.findOne({id:accid});
                        const source_privs = await getEffectivePrivs(source_rec);
                        /**@type {AccountRecord} */
                        const target_rec = await collection.findOne({id:data.acc});
                        const target_privs = await getEffectivePrivs(target_rec);
                        if (!check_can_moderate(source_privs, target_privs)) {
                            log(EBADMOD, `'${accid}'->'${data.acc}' (${data.id}) [canmod]`);
                            res.writeHead(403).end("insufficient permissions, this attempt has been logged");
                            return;
                        }
                        if (!check_sanction_allowed(source_privs, data.id)) {
                            log(EBADMOD, `'${accid}'->'${data.acc}' (${data.id}) [sancallow]`);
                            res.writeHead(403).end("insufficient permissions, this attempt has been logged");
                            return;
                        }
                        /**@type {SanctionRecord} */
                        const sobj = {
                            "appeal":null,
                            "appealable_date":data.appeals?(data.expires?data.expires-((data.expires-Date.now())/2):180*86400*1000):0,
                            "appeals_left":data.appeals,
                            "applied":Date.now(),
                            "expires":data.expires,
                            "sanction_id":data.id,
                            "notes":data.notes,
                            "rejections":[],
                            "source":accid,
                            "value":data.value,
                            "appeal_date":0,
                            "appeal_granted":0,
                            "granted_by":null,
                            "refid":target_rec.next_refid
                        };
                        if ((await collection.updateOne({id:data.acc},{"$push":{"sanction":sobj},"$inc":{"next_refid":1}})).modifiedCount) {
                            res.writeHead(200).end();
                            return;
                        }
                        res.writeHead(500).end("unknown failure");
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
                default:
                    res.writeHead(404).end();
                    return;
            }
        }
        case "PATCH": {
            switch (stripped) {
                // manage sanction
                case "/Msanction": {
                    if (!check_permission(adminperms, Permissions.MODERATE)) {
                        res.writeHead(403,{"content-type":"text/plain"}).end("insufficient permissions");
                        return;
                    }
                    /**@type {AdminSancManData} */
                    const data = JSON.parse(body);
                    if (!validateJSONScheme(data, schemes.adminSancManScheme)) {
                        res.writeHead(400).end("misformed man data");
                        return;
                    }
                    if ("appeal" in data && !validateJSONScheme(data.appeal, schemes.adminSancManAppealScheme)) {
                        res.writeHead(400).end("misformed appeal man");
                        return;
                    }
                    try {
                        const acr = await getAccountRecord(accid);
                        const mod_p = await getEffectivePrivs(acr);
                        const tacr = await getAccountRecord(data.acc);
                        const tar_p = await getEffectivePrivs(tacr);
                        /**@type {SanctionRecord} */
                        const rec = ((await collection.find({id:data.acc}).project({sanction:{$elemMatch:{refid:data.refid}}}).tryNext())?.sanction??[])[0];
                        if (!rec) {
                            res.writeHead(404).end("sanction not found");
                            return;
                        }
                        if (!(check_sanction_allowed(mod_p,rec.sanction_id)&&check_can_moderate(mod_p, tar_p))) {
                            // console.log(`MODP: ${mod_p}\nSID: ${rec.sanction_id}\nREC: ${JSON.stringify(rec)}\nTARP: ${tar_p}\nS_ALLOW: ${check_sanction_allowed(mod_p,rec.sanction_id)}\nCAN_MOD: ${check_can_moderate(mod_p, tar_p)}`);
                            res.writeHead(403,{"content-type":"text/plain"}).end("you do not have permission to modify this sanction");
                            return;
                        }
                        const upd = {"$set":{},"$bit":{},"$push":{}};
                        const sanction = "sanction.$[a]";
                        if ("cancel" in data) {
                            upd["$bit"][`${sanction}.sanction_id`] = {"and":0x5fffffff,"or":data.cancel?0x20000000:0};
                        }
                        if ("appeal" in data) {
                            if (data.appeal.accept) {
                                upd["$bit"][`${sanction}.sanction_id`] = {"or":0x20000000};
                                upd["$set"][`${sanction}.appeal_granted`] = Date.now();
                                upd["$set"][`${sanction}.granted_by`] = accid;
                            } else {
                                upd["$push"][`${sanction}.rejections`] = {"source":accid,"date":Date.now(),"notes":data.appeal.notes??"<no notes>","value":data.appeal.value??0,"appeal":rec.appeal,"adate":rec.appeal_date};
                                upd["$set"][`${sanction}.appeal`] = null;
                                upd["$set"][`${sanction}.appeal_date`] = 0;
                            }
                        }
                        if ("expires" in data) {
                            upd["$set"][`${sanction}.expires`] = data.expires;
                        }
                        if ("notes" in data) {
                            upd["$set"][`${sanction}.notes`] = data.notes;
                        }
                        if ("value" in data) {
                            upd["$set"][`${sanction}.value`] = data.value;
                        }
                        if ((await collection.updateOne({id:data.acc},upd,{arrayFilters:[{"a.refid":{"$eq":data.refid}}]})).modifiedCount) {
                            res.writeHead(200).end();
                            return;
                        }
                        res.writeHead(500).end("unknown failure");
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized ?? "Internal Error");
                    }
                    return;
                }
                default:
                    res.writeHead(404).end();
                    return;
            }
        }
    }
}

exports.processAdminFetch = processAdminFetch;

let adminDebugCommand = async function(l) {
    console.log(await Promise.resolve(eval(l)));
};

if (process.argv.includes("--no-in")) {
    adminDebugCommand = async () => {};
}

exports.adminDebugCommand = adminDebugCommand;
