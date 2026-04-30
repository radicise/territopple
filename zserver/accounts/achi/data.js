/**
 * @file
 * this file contains data that specifies achievements
 */

const ty = require("./types.js");
const ActKind = ty.ActKind;

/**@type {Record<number,(ty.ActionGroup|ty.Action)&{name:string}>} */
const ACTIONS = {};
/**@type {Record<string,number>} */
const NAMED_ACTIONS = {};
/**@type {Record<number,ty.AchiDef&{name:string}>} */
const ACHIEVEMENTS = {};
/**@type {Record<string,number>} */
const NAMED_ACHIEVEMENTS = {};

/////////// HELPERS ///////////

const {id, Kind} = (()=>{
    /**@type {number[]} */
    const counters = [];
    /**
     * @enum {number}
     */
    const Kind = {
        ACT: 0,
        GRP: 1,
        ACH: 2,
    };
    counters.fill(0,0,Object.keys(Kind).length);
    /**
     * @param {Kind} k
     * @returns {number}
     */
    const id = (k) => {
        switch (k) {
            case Kind.ACH:
            case Kind.ACT:return counters[k]++;
            case Kind.GRP:return --counters[k];
        }
    };
    return {id, Kind};
})();

/**
 * @param {string} name
 * @param {number} id
 * @param {Buffer} data
 */
const action = (name, id, data) => {
    ACTIONS[id] = {id,data,name};
    NAMED_ACTIONS[name] = id;
};
/**
 * @typedef {{ranked:boolean,player:boolean,victor:boolean}} ADS_COPTS
 * @typedef {{opts:ADS_COPTS&{specific:true},accid:string}|
 * {opts:ADS_COPTS&{specific?:false,groups:"user"},TODO:null}|
 * {opts:ADS_COPTS&{specific?:false,groups:"perms"},id:number}|
 * {opts:ADS_COPTS&{specific?:false,groups:"cond"},TODO:null}} ADS_FOPTS
 */
/**
 * @typedef ActDataSpec
 * @type {{kind:0|4}|
 * ({kind:1}&ADS_FOPTS)|
 * ({kind:2,TODO:null})}
 */

/**
 * @param {ActDataSpec} spec
 * @returns {Buffer}
 */
const actdata = (spec) => {
    /**@type {Buffer} */
    let buf;
    switch (spec.kind) {
        case ActKind.MANUAL:case ActKind.SERVER_MANUAL: {
            buf = Buffer.alloc(2);
            break;
        }
        case ActKind.MEETS: {
            const bits = [spec.opts.ranked,spec.opts.player,spec.opts.victor,false,false,false,false,false];
            if (spec.opts.specific) {
                buf = Buffer.alloc(4+spec.accid.length);
                bits[3] = true;
                buf[3] = spec.accid.length;
                buf.write(spec.accid,4,spec.accid.length,"ascii");
            } else {
                switch (spec.opts.groups) {
                    case "user": {
                        break;
                    }
                    case "perms": {
                        bits[5] = true;
                        buf = Buffer.alloc(7);
                        buf.writeInt32BE(spec.id,3);
                        break;
                    }
                    case "cond": {
                        bits[4] = true;
                        break;
                    }
                }
            }
            buf[2] = bits.map((v,i) => (v?1:0)<<(7-i)).reduce((pv,cv)=>pv|cv,0);
            break;
        }
        default: {
            buf = Buffer.alloc(2);
            break;
        }
    }
    buf.writeUInt16BE(spec.kind);
    return buf;
};
/**
 * @param {string} name
 * @param {number} id
 * @param {string[]} acts
 */
const agroup = (name, id, acts) => {
    acts = acts.map(v => NAMED_ACTIONS[v].id);
    ACTIONS[id] = {id:id,acts,name};
    NAMED_ACTIONS[name] = id;
};
/**
 * @param {string} name
 * @param {number} id
 * @param {ty.Granting} granting
 * @param {ty.DataSpec[]} data
 * @param {ty.Mutator[]} evo
 * @param {ty.Display} display
 */
const achieve = (name, id, granting, data, evo, display) => {
    ACHIEVEMENTS[id] = {id,name,granting,data,evo,display};
    NAMED_ACHIEVEMENTS[name] = id;
};

/**
 * @param {string} achi
 * @param {string} dname
 * @param {ty.ConditionCmp} cmp
 * @param {bigint} value
 * @returns {ty.Prerequisite}
 */
const pre = (achi, dname, cmp, value) => {
    return {id:NAMED_ACHIEVEMENTS[achi],cond:{name:dname,cmp,value}};
};

/////////// DATA ///////////

action("const:init",0,actdata({kind:ActKind.SERVER_MANUAL}));
action("meets:tristan",1,actdata({kind:ActKind.MEETS,opts:{specific:true,ranked:false,victor:false,player:true},accid:"TristanS"}));

achieve("played:tristan",1,{prereqs:{comb:0,sub:[]},acts:0},[
    {bits:1n,name:"0",type:ty.AchiDataType.UINT}
],[
    {act:1,dis:0,mut:[{name:"0",op:ty.MutOp.SET,val:1n}]}
],{comb:ty.Combinator.DISTINCT,fmts:[
    {cond:{name:"0",cmp:ty.ConditionCmp.EQ,value:1n},badge:"",icon:"",fmt:"You played a match against Tristan!"}
]});

exports.ACTIONS = ACTIONS;
exports.ACHIEVEMENTS = ACHIEVEMENTS;
