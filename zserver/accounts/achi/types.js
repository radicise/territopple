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
 * @prop {{prereqs:DBPrereqs,acts:string[],init:any}} granting
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
 * @typedef {{id:string,data:Buffer}} Action
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
 * @typedef {{prereqs:Prereqs,acts:number,init:any}} Granting
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
