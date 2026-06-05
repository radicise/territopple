/**
 * @file
 * primary achievement logic
 */
const { clone } = require("../../../defs.js");
const { acts_data, mdb, achi_data } = require("../db.js");
const { AccountRecord } = require("../types.js");
const { executeAchiCode } = require("./lang.js");
const ty = require("./types.js");

/**@type {Record<string,{grps:string[],achis:number[],evos:Array<[number,number]>,data:Buffer,perm:number[]}>} */
let ACTIONS = {};
/**@type {Record<number,ty.AchiDef>} */
let ACHIEVEMENTS = {};
/**@type {Record<string,string>} */
let WATCHES = {};

/**@type {Promise<void>} */
let globalSyncLock = Promise.resolve();


async function fetchAchievements() {
    await globalSyncLock;
    // clear any old achievement data
    ACTIONS = {};
    ACHIEVEMENTS = {};
    WATCHES = {};
    let completer;
    globalSyncLock = new Promise(r => {completer = r;});
    try {
        for await (const act of acts_data.find({},{sort:{id:1}})) {
            if (!(act.id in ACTIONS)) {
                ACTIONS[act.id] = {grps:[],achis:[],evos:[]};
            }
            if (act.acts) {
                for (const o of act.acts) {
                    if (!(o in ACTIONS)) {
                        ACTIONS[o] = {grps:[],achis:[],evos:[]};
                    }
                    ACTIONS[o].grps.push(act.id);
                }
            } else {
                ACTIONS[act.id].data = act.data.buffer;
                ACTIONS[act.id].perm = act.perm;
                switch (act.data.buffer[0]) {
                    case 2: {
                        const namel = act.data.buffer[1];
                        const name = act.data.buffer.subarray(2, namel+2).toString("ascii");
                        if (name in WATCHES) {
                            WATCHES[name].push(act.id);
                        } else {
                            WATCHES[name] = [act.id];
                        }
                        break;
                    }
                }
            }
        }
        for await (const achi of achi_data.find({})) {
            ACHIEVEMENTS[achi.id] = {
                id: achi.id.value,
                name: achi.name,
                granting: {
                    acts:achi.granting.acts,
                    prereqs:{
                        comb:achi.granting.prereqs.comb.value,
                        subs:achi.granting.prereqs.subs.map(v=>({id:v.id.value,cond:v.cond.buffer}))
                    },
                    init:achi.granting.init
                },
                evo: achi.evo.map(v => ({act:v.act,dis:v.dis,mut:v.mut.map(v2=>v2.buffer)})),
                display: {
                    comb:achi.display.comb.value,
                    values:Object.fromEntries(Object.entries(achi.display.values).map(v=>[v[0],v[1].buffer])),
                    fmts:achi.display.fmts.map(v=>({cond:v.cond.buffer,fmt:v.fmt,icon:v.icon,badge:v.badge}))
                },
                population: achi.population.toBigInt()
            }
            for (const act of achi.granting.acts) {
                if (act in ACTIONS) {
                    ACTIONS[act].achis.push(achi.id.value);
                }
            }
            for (const [act,i] of achi.evo.map((v,i) => [v.act,i])) {
                if (act in ACTIONS) {
                    ACTIONS[act].evos.push([act,i]);
                }
            }
        }
    } catch (E) {
        //
    } finally {
        completer();
    }
}

/**
 * gets the list of permissions that allow an admin to trigger an action
 * @param {string} action
 * @returns {Promise<number[]>}
 */
async function getRequiredPermissions(action) {
    await globalSyncLock;
    const act = ACTIONS[action];
    if (!act) {
        return [];
    }
    if (!act.perm) {
        return [];
    }
    return act.perm;
}

/**
 * @param {AccountRecord} account
 * @param {ty.Prereqs} prereqs
 * @returns {Promise<boolean>}
 */
async function verifyPrereqs(account, prereqs) {
    /**
     * @param {ty.Prerequisite} pre
     * @param {ty.Achievement} achi
     */
    const verifyPre = async (pre, achi) => {
        const result = await executeAchiCode(pre.cond, account, achi);
        if (result.err) {
            return false;
        }
        return Boolean(result.value);
    };
    if (prereqs.comb === ty.PCombinator.ANY) {
        for (const p of prereqs.sub) {
            const achi = account.achieve?.find(v => v.id === p.id);
            if (!achi) {
                continue;
            }
            if (await verifyPre(p, achi)) {
                return true;
            }
        }
        return false;
    } else if (prereqs.comb === ty.PCombinator.ALL) {
        for (const p of prereqs.sub) {
            const achi = account.achieve?.find(v => v.id === p.id);
            if (!achi) {
                return false;
            }
            if (!(await verifyPre(p, achi))) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * @param {AccountRecord} account
 * @param {string} actionid
 * @param {number} discriminator
 * @returns {Promise<{granted:ty.Achievement[],mutated:ty.Achievement[]}>}
 */
async function triggerManual(account, actionid, discriminator) {
    await globalSyncLock;
    const granted = [];
    const mutated = [];
    const achieve = account.achieve ?? {};
    /**@type {Set<number>} */
    const toTrigger = new Set();
    /**@type {Record<number,Set<number>>} */
    const toEvo = {};
    const triggeredActions = new Set();
    const actions = [actionid];
    while (actions.length) {
        /**@type {string} */
        const act = actions.pop();
        if (triggeredActions.has(act)) {
            continue;
        }
        triggeredActions.add(act);
        const data = ACTIONS[act];
        if (!data) {
            continue;
        }
        actions.push(...data.grps);
        data.achis.forEach(v => {
            if (v in achieve) {
                return;
            }
            toTrigger.add(v);
        });
        data.evos.forEach(v => {
            if (!(v[0] in achieve)) {
                return;
            }
            /**@type {ty.Mutator} */
            const mut = (ACHIEVEMENTS[v[0]]?.evo??[])[v1];
            if (!mut) {
                return;
            }
            if (mut.dis !== discriminator) {
                return;
            }
            if (v[0] in toEvo) {
                toEvo[v[0]].add(v[1]);
            } else {
                toEvo[v[0]] = new Set([v[1]]);
            }
        });
    }
    await Promise.all([...toTrigger.values()].map(v => new Promise(async r => {
        /**@type {ty.AchiDef} */
        const achi = ACHIEVEMENTS[v];
        if (!achi) {
            r();
            return;
        }
        if (!(await verifyPrereqs(account, achi.granting.prereqs))) {
            r();
            return;
        }
        granted.push({id:achi.id,data:achi.granting.init});
        r();
    })));
    for (const k in toEvo) {
        /**@type {ty.AchiDef} */
        const achi = ACHIEVEMENTS[k];
        if (!achi) {
            return;
        }
        /**@type {ty.Achievement} */
        let work = {id:Number(k),data:clone(achieve.find(v => v.id === Number(k)).data)};
        await Promise.all([...toEvo[k].values()].map(i => new Promise(async r => {
            const mut = achi.evo[i];
            let nwork = {id:work.id,data:clone(work.data)};
            const result = await executeAchiCode(mut.mut, account, work);
            if (result.err === null) {
                work = nwork;
            }
            r();
        })));
        mutated.push(work);
    }
    return {granted,mutated};
}

function getAchievements() {
    return ACHIEVEMENTS;
}
function getActions() {
    return ACTIONS;
}

exports.fetchAchievements = fetchAchievements;
exports.triggerManual = triggerManual;
exports.getRequiredPermissions = getRequiredPermissions;
exports.getAchievements = getAchievements;
exports.getActions = getActions;
