const http = require("http");
const { ACC_ADMIN_PREFIX } = require("../constants.js");
const { ASessionManager, extractASessionId } = require("../sessions.js");
const { AccountRecord } = require("../types.js");
const { collection } = require("../db.js");
const { check_permission, check_can_moderate, check_sanction_allowed, Permissions } = require("../perms.js");
const { validateJSONScheme } = require("../../../defs.js");
const schemes = require("../schemes.js");
const auth = require("../auth.js");

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
        const id = ASessionManager.getAccountId(extractASessionId(req.headers.cookie))
        if (id) {
            res.writeHead(200).end(JSON.stringify({name:id}));
        } else {
            res.writeHead(400).end();
        }
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
            if (!check_permission(privs, Permissions.MODERATE)) {
                res.writeHead(403).end("account is not an admin");
                return;
            }
            if (auth.verifyRecordPassword(doc.pwdata.buffer, data.pw)) {
                // res.writeHead(200, {"Set-Cookie":`sessionId=${SessionManager.createSession(data.id)}; Same-Site=Lax; Secure; HttpOnly; Path=/`}).end();
                res.writeHead(200, {"Set-Cookie":makeASessionCookie(ASessionManager.createSession(data.id))}).end();
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
    switch (req.method) {
        case "GET":{
            switch (stripped) {
                case "/priv-group-info": {
                    const target = url.searchParams.get("id");
                    if (!target) {
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
                        res.writeHead(200, {"content-type":"application/json"}).end(JSON.stringify(rec));
                    } catch (E) {
                        console.log(E);
                        res.writeHead(500).end(E.sanitized??"internal error");
                    }
                    return;
                }
            }
            res.writeHead(404).end();
            return;
        }
        case "POST":{
            switch (stripped) {
                // normal sanction
                case "/Nsanction": {
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
                        /**@type {SanctionRecord} */
                        const rec = await collection.find({id:data.acc}).project({sanction:{$elemMatch:{refid:data.refid}}}).tryNext();
                        if (rec === null) {
                            res.writeHead(404).end("sanction not found");
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
