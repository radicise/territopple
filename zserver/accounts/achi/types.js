/**
 * @file
 * this file provides type definitions for achivement data
 */

/**
 * @typedef {string} FString
 */
/**
 * @typedef {{id:number,acts:number[]}} ActionGroup
 */
/**
 * @typedef {{id:number,data:Buffer}} Action
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
 * fmts: {cond: Condition, fmt: FString, icon: FString, badge: FString}[]
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
 * @typedef {{id:number,cond:Condition}} Prerequisite
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
 * act: number,
 * dis: number,
 * mut: {name:string,op:MutOp,val:bigint}[]
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
 * @typedef {{prereqs:Prereqs,acts:number}} Granting
 */
/**
 * @typedef {{bits:bigint,type:AchiDataType,name:string}} DataSpec
 */
/**
 * @typedef AchiDef
 * @type {{
 * id: number,
 * granting: Granting,
 * data: DataSpec[],
 * evo:Mutator[],
 * display: Display
 * }}
 */
/**
 * @typedef {{id:number,data:bigint}} Achievement
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
