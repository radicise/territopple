/**
 * @file
 * primary achievement logic
 */
const { clone } = require("../../../defs.js");
const { acts_data, mdb, achi_data, client } = require("../db.js");
const { AccountRecord } = require("../types.js");
const { executeAchiCode } = require("./lang.js");
const ty = require("./types.js");
const { AsyncLocalStorage } = require("async_hooks");


class MutexError extends Error {
    /**
     * @param {string?} message
     */
    constructor(message) {
        super(message);
        this.name = "MutexError";
    }
}

/**
 * concurrency-safe reentrant mutex
 */
class AchiData {
    /**
     * @typedef {Record<string,{grps:string[],achis:number[],evos:Array<[number,number]>,data:Buffer,perm:number[]}>} ActionStore
     */
    /**@type {Promise<void>} */
    static #ownerprom = Promise.resolve();
    /**@type {number|null} */
    static #currowner = null;
    /**@type {AsyncLocalStorage<number>} */
    static #storage = new AsyncLocalStorage();
    /**@type {number} */
    static #entrydepth = 0;
    /**@type {number} */
    static #nextowner = 0;
    /**@type {ActionStore} */
    static #ACTIONS = {};
    /**@type {Record<number,ty.AchiDef>} */
    static #ACHIEVEMENTS = {};
    /**@type {Record<string,string>} */
    static #WATCHES = {};

    static checkOwner() {
        return this.#currowner === this.#storage.getStore();
    }
    static #doErr() {throw new MutexError("attempted access without acquisition");}
    /**
     * @returns {ActionStore}
     */
    static get ACTIONS() {
        if (!this.checkOwner()) this.#doErr();
        return this.#ACTIONS;
    }
    /**
     * @param {ActionStore} v
     */
    static set ACTIONS(v) {
        if (!this.checkOwner()) this.#doErr();
        this.#ACTIONS = v;
    }
    /**
     * @returns {Record<number, ty.AchiDef>}
     */
    static get ACHIEVEMENTS() {
        if (!this.checkOwner()) this.#doErr();
        return this.#ACHIEVEMENTS;
    }
    /**
     * @param {Record<number, ty.AchiDef>} v
     */
    static set ACHIEVEMENTS(v) {
        if (!this.checkOwner()) this.#doErr();
        this.#ACHIEVEMENTS = v;
    }
    /**
     * @returns {Record<string, string>}
     */
    static get WATCHES() {
        if (!this.checkOwner()) this.#doErr();
        return this.#WATCHES;
    }
    /**
     * @param {Record<string, string>} v
     */
    static set WATCHES(v) {
        if (!this.checkOwner()) this.#doErr();
        this.#WATCHES = v;
    }

    /**
     * @param {()=>(Promise<any>|any)} cb
     * @param {object} options
     * @param {number?} options.aquire_to aquisition timeout
     * @param {number?} options.exec_to callback execution timeout
     * @returns {Promise<void>}
     */
    static async aquire(cb, options) {
        options = options ?? {};
        let completer;
        if (!this.checkOwner()) {
            let timedout = false;
            await Promise.race([this.#ownerprom,new Promise(r => setTimeout(()=>{timedout=true;r();}, options.aquire_to))]);
            if (timedout) {
                return;
            }
            this.#ownerprom = new Promise(r => {completer = r;});
        }
        let caughtErr = null;
        try {
            const storeid = this.#storage.getStore();
            let ownid;
            if (storeid === undefined) {
                ownid = this.#nextowner;
                this.#nextowner = (this.#nextowner + 1) % 65535;
            } else {
                ownid = storeid;
            }
            this.#currowner = ownid;
            let execprom;
            if (storeid === undefined) {
                execprom = this.#storage.run(ownid, () => {
                    return Promise.resolve(cb());
                });
            } else {
                execprom = Promise.resolve(cb());
            }
            if (options.exec_to) {
                await Promise.race([execprom, new Promise(r=>setTimeout(r,options.exec_to))]);
            } else {
                await execprom;
            }
        } catch (E) {
            caughtErr = E;
        }
        this.#release(completer);
        if (caughtErr) {
            throw caughtErr;
        }
    }

    /**
     * @param {()=>void} completer
     */
    static #release(completer) {
        this.#entrydepth --;
        if (this.#entrydepth === 0) {
            this.#currowner = null;
            if (completer) completer();
        }
    }

    /**
     * used to allow code outside this module to peek the resource
     * @returns {ActionStore}
     */
    static getActions_unsafe() {
        return this.#ACTIONS;
    }
    /**
     * used to allow code outside this module to peek the resource
     * @returns {Record<number, ty.AchiDef>}
     */
    static getAchievements_unsafe() {
        return this.#ACHIEVEMENTS;
    }
    /**
     * used to allow code outside this module to peek the resource
     * @returns {Record<string, string>}
     */
    static getWatches_unsafe() {
        return this.#WATCHES;
    }
}

/**
 * creates an action that did not exist before
 * returns true if the action was created
 * @param {ty.Action|ty.ActionGroup} act
 * @param {boolean} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function createAction(act, updatemem) {
    if (!ty.validateActionlike(act)) return false;
    let rv = false;
    await AchiData.aquire(async () => {
        if (act.id in AchiData.ACTIONS) return;
        try {
            if (!(await acts_data.insertOne(act)).acknowledged) {
                return;
            }
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            AchiData.ACTIONS[act.id] = {grps:[],achis:[],evos:[]};
            if (act.id[0] === "+") {
                AchiData.ACTIONS[act.id].data = act.data;
                AchiData.ACTIONS[act.id].perm = act.perm;
            } else {
                for (const id of act.acts) {
                    if (id in AchiData.ACTIONS) {
                        AchiData.ACTIONS[id].grps.push(act.id);
                    }
                }
            }
        }
        rv = true;
    });
    return rv;
}
/**
 * updates an existing action
 * returns true if the action was updated
 * @param {ty.Action|ty.ActionGroup} act
 * @param {boolean?} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function updateAction(act, updatemem) {
    if (!ty.validateActionlike(act)) return false;
    rv = false;
    await AchiData.aquire(async () => {
        if (!(act.id in AchiData.ACTIONS)) return;
        try {
            if ((await acts_data.replaceOne({id:act.id}, act)).modifiedCount === 0) {
                return;
            }
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            // TODO: optimize
            await fetchAchievements();
        }
        rv = true;
    });
    return rv;
}
/**
 * deletes an action
 * returns true if the action was deleted or did not exist
 * @param {string} actid
 * @param {boolean?} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function deleteAction(actid, updatemem) {
    let rv = false;
    await AchiData.aquire(async () => {
        if (!(actid in AchiData.ACTIONS)) {
            rv = true;
            return;
        }
        try {
            await acts_data.deleteOne({id:actid});
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            // TODO: optimize
            await fetchAchievements();
        }
        rv = true;
    });
    return rv;
}

/**
 * creates an achievement that did not exist before
 * returns true if the achievement was created
 * @param {ty.AchiDef} achi
 * @param {boolean} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function createAchievement(achi, updatemem) {
    if (!ty.validateAchievement(achi)) return false;
    let rv = false;
    await AchiData.aquire(async () => {
        if (achi.id in AchiData.ACHIEVEMENTS) return;
        try {
            if (!(await achi_data.insertOne(achi)).acknowledged) {
                return;
            }
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            AchiData.ACHIEVEMENTS[achi.id] = achi;
            if (achi.granting.acts in AchiData.ACTIONS) {
                AchiData.ACTIONS[achi.granting.acts].achis.push(achi.id);
            }
            for (const [act,i] of achi.evo.map((v,i) => [v.act,i])) {
                if (act in AchiData.ACTIONS) {
                    AchiData.ACTIONS[act].evos.push([act,i]);
                }
            }
        }
        rv = true;
    });
    return rv;
}
/**
 * updates an existing achievement
 * returns true if the achievement was updated
 * @param {ty.AchiDef} achi
 * @param {boolean?} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function updateAchievement(achi, updatemem) {
    if (!ty.validateAchievement(achi)) return false;
    rv = false;
    await AchiData.aquire(async () => {
        if (!(act.id in AchiData.ACHIEVEMENTS)) return;
        try {
            if ((await achi_data.replaceOne({id:achi.id}, achi)).modifiedCount === 0) {
                return;
            }
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            // TODO: optimize
            await fetchAchievements();
        }
        rv = true;
    });
    return rv;
}
/**
 * deletes an achievement
 * returns true if the achievement was deleted or did not exist
 * @param {number} achiid
 * @param {boolean?} updatemem
 * @returns {Promise<boolean>}
 * @throws {mdb.MongoError}
 */
async function deleteAchievement(achiid, updatemem) {
    let rv = false;
    await AchiData.aquire(async () => {
        if (!(achiid in AchiData.ACHIEVEMENTS)) {
            rv = true;
            return;
        }
        try {
            await achi_data.deleteOne({id:achiid});
        } catch (E) {
            throw E;
        }
        if (updatemem) {
            // TODO: optimize
            await fetchAchievements();
        }
        rv = true;
    });
    return rv;
}

/**
 * @template T
 * @template U
 * @typedef {{create:T[],update:T[],delete:U[]}} BulkChange
 */
/**
 * @typedef {{created:number,updated:number,deleted:number}} BulkChangeResult
 */

/**
 * performs a bulk write operation for achievements and actions
 * if any mongodb operation fails, the operation is guaranteed to be reverted
 * @param {{acts:BulkChange<ty.Action|ty.ActionGroup,string>,achi:BulkChange<ty.AchiDef,number>}} data
 * @param {boolean} updatemem
 * @returns {Promise<{acts:BulkChangeResult,achi:BulkChangeResult}>}
 * @throws {mdb.MongoError}
 */
async function bulkAchiWrite(data, updatemem) {
    /**@type {{acts:BulkChangeResult,achi:BulkChangeResult}} */
    const res = {acts:{created:0,updated:0,deleted:0},achi:{created:0,updated:0,deleted:0}};
    await AchiData.aquire(async () => {
        const ACTIONS = AchiData.ACTIONS;
        const ACHIEVEMENTS = AchiData.ACHIEVEMENTS;
        let success = true;
        await client.withSession(async (session) => {
            try {
                await session.withTransaction(async () => {
                    const actscreate = data.acts.create.filter(v => !(v.id in ACTIONS) && ty.validateActionlike(v))
                                        .map(v => ty.normalizeActionLike(v));
                    const actsupdate = data.acts.update.filter(v => (v.id in ACTIONS) && ty.validateActionlike(v))
                                        .map(v => ty.normalizeActionLike(v));
                    const actsdelete = data.acts.delete.filter(v => v.id in ACTIONS);
                    const achicreate = data.achi.create.filter(v => !(v.id in ACHIEVEMENTS) && ty.validateAchievement(v))
                                        .map(v => ty.normalizeAchievement(v));
                    const achiupdate = data.achi.update.filter(v => (v.id in ACHIEVEMENTS) && ty.validateAchievement(v))
                                        .map(v => ty.normalizeAchievement(v));
                    const achidelete = data.achi.delete.filter(v => v.id in ACHIEVEMENTS);
                    const acts_write = acts_data.bulkWrite([
                        ...actscreate.map(v => ({insertOne:{document:v}})),
                        ...actsupdate.map(v => ({replaceOne:{filter:{id:v.id},replacement:v}})),
                        ...actsdelete.map(v => ({deleteOne:{filter:{id:v}}}))
                    ],{session,ordered:false});
                    const achi_write = achi_data.bulkWrite([
                        ...achicreate.map(v => ({insertOne:{document:v}})),
                        ...achiupdate.map(v => ({replaceOne:{filter:{id:v.id},replacement:v}})),
                        ...achidelete.map(v => ({deleteOne:{filter:{id:v}}}))
                    ],{session,ordered:false});
                    await Promise.all([acts_write,achi_write]);
                    res.acts.created = actscreate.length;
                    res.acts.updated = actsupdate.length;
                    res.acts.deleted = data.acts.delete.length;
                    res.achi.created = achicreate.length;
                    res.achi.updated = achiupdate.length;
                    res.achi.deleted = data.achi.delete.length;
                });
            } catch (E) {
                console.log(E);
                res.acts.created = 0;
                res.acts.updated = 0;
                res.acts.deleted = 0;
                res.achi.created = 0;
                res.achi.updated = 0;
                res.achi.deleted = 0;
                success = false;
            }
        });
        if (!success) return;
        if (updatemem) {
            try {
                await fetchAchievements();
            } catch (E) {
                console.log(E);
            }
        }
    });
    return res;
}

async function fetchAchievements() {
    const ACTIONS = {};
    const ACHIEVEMENTS = {};
    const WATCHES = {};
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
        if (achi.granting.acts in ACTIONS) {
            ACTIONS[achi.granting.acts].achis.push(achi.id.value);
        }
        // for (const act of achi.granting.acts) {
        //     if (act in ACTIONS) {
        //         ACTIONS[act].achis.push(achi.id.value);
        //     }
        // }
        for (const [act,i] of achi.evo.map((v,i) => [v.act,i])) {
            if (act in ACTIONS) {
                ACTIONS[act].evos.push([act,i]);
            }
        }
    }
    await AchiData.aquire(async () => {
        AchiData.ACTIONS = ACTIONS;
        AchiData.ACHIEVEMENTS = ACHIEVEMENTS;
        AchiData.WATCHES = WATCHES;
    });
}

/**
 * gets the list of permissions that allow an admin to trigger an action
 * @param {string} action
 * @returns {Promise<number[]>}
 */
async function getRequiredPermissions(action) {
    let act;
    await AchiData.aquire(() => {
        act = AchiData.ACTIONS[action];
    });
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
    const granted = [];
    const mutated = [];
    await AchiData.aquire(async () => {
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
            const data = AchiData.ACTIONS[act];
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
                const mut = (AchiData.ACHIEVEMENTS[v[0]]?.evo??[])[v1];
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
            const achi = AchiData.ACHIEVEMENTS[v];
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
            const achi = AchiData.ACHIEVEMENTS[k];
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
    });
    return {granted,mutated};
}

function getAchievements() {
    return AchiData.getAchievements_unsafe();
}
function getActions() {
    return AchiData.getActions_unsafe();
}

exports.fetchAchievements = fetchAchievements;
exports.triggerManual = triggerManual;
exports.getRequiredPermissions = getRequiredPermissions;
exports.getAchievements = getAchievements;
exports.getActions = getActions;
exports.createAction = createAction;
exports.updateAction = updateAction;
exports.deleteAction = deleteAction;
exports.createAchievement = createAchievement;
exports.updateAchievement = updateAchievement;
exports.deleteAchievement = deleteAchievement;
exports.bulkAchiWrite = bulkAchiWrite;
