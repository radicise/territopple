/**
 * @file
 * this file provides type definitions for achivement data
 */

const mdb = require("mongodb");

/**
 * @typedef DBActionGroup
 * @type {object}
 * @prop {string} id
 * @prop {string[]} acts
 */
/**
 * @typedef DBAction
 * @type {object}
 * @prop {string} id
 * @prop {mdb.Binary} data
 * @prop {number[]} perm
 */
/**
 * @typedef DBDisplay
 * @type {object}
 * @prop {mdb.Int32} comb
 * @prop {Record<string,mdb.Binary>} values
 * @prop {{cond:mdb.Binary,fmt:string,icon:string,badge:string}[]} fmts
 */
/**
 * @typedef DBAchievement
 * @type {object}
 * @prop {mdb.Int32} id
 * @prop {any} data
 */
/**
 * @typedef DBPrereqs
 * @type {object}
 * @prop {mdb.Int32} comb
 * @prop {{id:mdb.Int32,cond:mdb.Binary}[]} subs
 */
/**
 * @typedef DBMutator
 * @type {object}
 * @prop {string} act
 * @prop {mdb.Int32} dis
 * @prop {mdb.Binary[]} mut
 */
/**
 * @typedef DBAchiDef
 * @type {object}
 * @prop {mdb.Int32} id
 * @prop {string} name
 * @prop {{prereqs:DBPrereqs,acts:string,init:any}} granting
 * @prop {DBMutator[]} evo
 * @prop {DBDisplay} display
 * @prop {mdb.Long} population
 */

/**
 * @typedef {string} FString
 */
/**
 * @typedef {{id:string,acts:string[]}} ActionGroup
 */
/**
 * @typedef {{id:string,data:Buffer,perm:number[]}} Action
 */
/**
 * @typedef {{name:string,value:bigint,cmp:ConditionCmp}} Condition
 */
/**
 * @enum {number}
 */
const ConditionCmp = {
    EQ: 0,
    GT: 1,
    LT: 2,
    GE: 3,
    LE: 4,
};
/**
 * @enum {number}
 */
const Combinator = {
    JOIN_SPACE: 0,
    FIRST_MATCH: 1,
    DISTINCT: 2,
};
/**
 * @typedef Display
 * @type {{
 * comb: Combinator,
 * values: Record<string,Buffer>,
 * fmts: {cond: Buffer, fmt: FString, icon: FString, badge: FString}[]
 * }}
 */
/**
 * @enum {number}
 */
const PCombinator = {
    ALL: 0,
    ANY: 1,
};
/**
 * @typedef {{id:number,cond:Buffer}} Prerequisite
 */
/**
 * @typedef {{comb:PCombinator,sub:Prerequisite[]}} Prereqs
 */
/**
 * @enum {number}
 */
const MutOp = {
    SET: 0,
    ADD: 1,
    SUB: 2,
    MUL: 3,
    DIV: 4,
};
/**
 * @typedef Mutator
 * @type {{
 * act: string,
 * dis: number,
 * mut: Buffer
 * }}
 */
/**
 * @enum {number}
 */
const AchiDataType = {
    FLAGSET: 0,
    UINT: 1,
    SINT: 2,
};
/**
 * @typedef {{prereqs:Prereqs,acts:string,init:any}} Granting
 */
/**
 * @typedef {{bits:bigint,type:AchiDataType,name:string}} DataSpec
 */
/**
 * @typedef AchiDef
 * @type {{
 * id: number,
 * name: string,
 * granting: Granting,
 * evo:Mutator[],
 * display: Display,
 * population: bigint
 * }}
 */
/**
 * @typedef {{id:number,data:any}} Achievement
 */

/**
 * @enum {number}
 */
const ActKind = {
    /**@type {0}@readonly */
    MANUAL: 0,
    /**@type {1}@readonly */
    MEETS: 1,
    /**@type {2}@readonly */
    FIELD: 2,
    /**@type {3}@readonly */
    ESOTERIC: 3,
    /**@type {4}@readonly */
    SERVER_MANUAL: 4,
};

/**
 * @typedef {Action|ActionGroup} ActionLike
 */

exports.ActKind = ActKind;
exports.ConditionCmp = ConditionCmp;
exports.AchiDataType = AchiDataType;
exports.MutOp = MutOp;
exports.Combinator = Combinator;
exports.PCombinator = PCombinator;
exports.ActionGroup = this.ActionGroup;
exports.Action = this.Action;
exports.Condition = this.Condition;
exports.Display = this.Display;
exports.Prerequisite = this.Prerequisite;
exports.Prereqs = this.Prereqs;
exports.Mutator = this.Mutator;
exports.Granting = this.Granting;
exports.DataSpec = this.DataSpec;
exports.AchiDef = this.AchiDef;
exports.Achievement = this.Achievement;
exports.DBAction = this.DBAction;
exports.DBActionGroup = this.DBActionGroup;
exports.DBAchievement = this.DBAchievement;
exports.DBAchiDef = this.DBAchiDef;
exports.DBDisplay = this.DBDisplay;
exports.DBMutator = this.DBMutator;
exports.DBPrereqs = this.DBPrereqs;
exports.ActionLike = this.ActionLike;

/**
 * @param {Buffer|Uint8Array|Array<number>} buf
 * @returns {boolean}
 */
function isBufferLike(buf) {
    if (Buffer.isBuffer(buf)) return true;
    if (buf instanceof Uint8Array) return true;
    return Array.isArray(buf) && buf.every(v => typeof v === "number" && v >= 0 && v < 256);
}

/**
 * @param {Action|ActionGroup} act
 * @returns {boolean}
 */
function validateActionlike(act) {
    if (typeof act.id !== "string") return false;
    if (act.id[0] === "-") return validateActionGroup(act);
    if (act.id[0] === "+") return validateAction(act);
    return false;
}
/**
 * @param {ActionGroup} grp
 * @returns {boolean}
 */
function validateActionGroup(grp) {
    if (typeof grp.id !== "string" || grp.id[0] !== "-") return false;
    return Array.isArray(grp.acts) && grp.acts.every(v => typeof v === "string");
}
/**
 * @param {Action} act
 * @returns {boolean}
 */
function validateAction(act) {
    if (typeof act.id !== "string" || act.id[0] !== "+") return false;
    if (act.perm && (!Array.isArray(act.perm) || act.perm.some(v => typeof v !== "number"))) return false;
    return validateActionData(act.data);
}
/**
 * @param {Buffer} data
 * @returns {boolean}
 */
function validateActionData(data) {
    if (!isBufferLike(data)) return false;
    const type = (data[0]<<8) | data[1];
    switch (type) {
        case ActKind.MANUAL:case ActKind.SERVER_MANUAL: {
            if (data.length !== 2) return false;
            return true;
        }
        case ActKind.ESOTERIC: {
            return false;
        }
        case ActKind.MEETS: {
            const flags = data[2];
            if (flags & 0x10) {
                const l = data[3];
                return data.length === l + 4;
            }
            const grps = (flags & 0x0c) >> 2;
            switch (grps) {
                case 0: {
                    return false;
                }
                case 1: {
                    return data.length === 7;
                }
                case 2: {
                    return false;
                }
                case 3: {
                    return false;
                }
            }
        }
        case ActKind.FIELD: {
            const l = data[2];
            return data.length === l + 4;
        }
        default: {
            return false;
        }
    }
}

/**
 * @param {AchiDef} achi
 * @returns {boolean}
 */
function validateAchievement(achi) {
    if (typeof achi.id !== "number" || typeof achi.name !== "string" || typeof achi.population !== "bigint") return false;
    if (!validateGranting(achi.granting)) return false;
    if (!achi.evo.every(v => validateMutator(v))) return false;
    return validateDisplay(achi.display);
}
/**
 * @param {Granting} grant
 * @returns {boolean}
 */
function validateGranting(grant) {
    if (typeof grant.acts !== "string") return false;
    return validatePrereqs(grant.prereqs);
}
/**
 * @param {Prereqs} pres
 * @returns {boolean}
 */
function validatePrereqs(pres) {
    if (!(pres.comb === 0 || pres.comb === 1)) return false;
    return pres.sub.every(v => validatePrerequisite(v));
}
/**
 * @param {Prerequisite} pre
 * @returns {boolean}
 */
function validatePrerequisite(pre) {
    return typeof pre.id === "number" && isBufferLike(pre.cond);
}
/**
 * @param {Mutator} mut
 * @returns {boolean}
 */
function validateMutator(mut) {
    return typeof mut.act === "string" && typeof mut.dis === "number" && isBufferLike(mut.mut);
}
/**
 * @param {Display} disp
 * @returns {boolean}
 */
function validateDisplay(disp) {
    if (typeof disp.comb !== "number" || disp.comb < 0 || disp.comb > 2) return false;
    if (!Object.values(disp.values).every(v => isBufferLike(v))) return false;
    return disp.fmts.every(v => 
        typeof v.badge === "string"
        && typeof v.icon === "string"
        && typeof v.fmt === "string"
        && isBufferLike(v.cond)
    );
}

/**
 * ensures that the given action-like data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {ActionLike} act
 * @returns {ActionLike}
 */
function normalizeActionLike(act) {
    if (act.id[0] === "+") {
        if (!Buffer.isBuffer(act.data)) {
            act.data = Buffer.from(act.data);
        }
        if (!act.perm) {
            act.perm = [];
        }
    }
    return act;
}
/**
 * ensures that the given achievement data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {AchiDef} achi
 * @returns {AchiDef}
 */
function normalizeAchievement(achi) {
    normalizeGranting(achi.granting);
    achi.evo.forEach(v => normalizeMutator(v));
    normalizeDisplay(achi.display);
}
/**
 * ensures that the given granting data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {Granting} grant
 * @returns {Granting}
 */
function normalizeGranting(grant) {
    if ((grant.init ?? null) === null) {
        grant.init = null;
    }
    normalizePrereqs(grant.prereqs);
    return grant;
}
/**
 * ensures that the given prereqs data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {Prereqs} pres
 * @returns {Prereqs}
 */
function normalizePrereqs(pres) {
    pres.sub.forEach(v => normalizePrerequisite(v));
    return pres;
}
/**
 * ensures that the given prerequisite data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {Prerequisite} pre
 * @returns {Prerequisite}
 */
function normalizePrerequisite(pre) {
    if (!Buffer.isBuffer(pre.cond)) pre.cond = Buffer.from(pre.cond);
    return pre;
}
/**
 * ensures that the given mutator data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {Mutator} mut
 * @returns {Mutator}
 */
function normalizeMutator(mut) {
    if (!Buffer.isBuffer(mut.mut)) mut.mut = Buffer.from(mut.mut);
    return mut;
}
/**
 * ensures that the given display data is in the canonical form
 * the data must be structured correctly, but may have arrays in place of buffers
 * and optional properties omitted
 * the provided object is modified in-place
 * @param {Display} disp
 * @returns {Display}
 */
function normalizeDisplay(disp) {
    disp.fmts.forEach(v => {
        if (!Buffer.isBuffer(v.cond)) v.cond = Buffer.from(v.cond);
    });
    for (const k in disp.values) {
        if (!Buffer.isBuffer(disp.values[k])) disp.values[k] = Buffer.from(disp.values[k]);
    }
    return disp;
}

exports.validateActionlike = validateActionlike;
exports.validateAction = validateAction;
exports.validateActionData = validateActionData;
exports.validateActionGroup = validateActionGroup;
exports.validateAchievement = validateAchievement;
exports.validateDisplay = validateDisplay;
exports.validateGranting = validateGranting;
exports.validateMutator = validateMutator;
exports.validatePrereqs = validatePrereqs;
exports.validatePrerequisite = validatePrerequisite;
exports.normalizeActionLike = normalizeActionLike;
exports.normalizeAchievement = normalizeAchievement;
exports.normalizeGranting = normalizeGranting;
exports.normalizePrereqs = normalizePrereqs;
exports.normalizePrerequisite = normalizePrerequisite;
exports.normalizeMutator = normalizeMutator;
exports.normalizeDisplay = normalizeDisplay;
