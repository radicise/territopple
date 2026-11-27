const { AchiHookMod, AchiStateMod, AchiModDef, AchiModFunc } = require("../types.js");
const mdb = require("mongodb");

/**@type {AchiModFunc} */
const handler = (hook, acc, data) => {
    /**@type {AchiStateMod[]} */
    const updates = [];
    if (hook === "init" || hook === "scan.periodic") {
        updates.push({id:"anniversary",fields:{age:{op:"set",value:new mdb.Int32(new Date().getUTCFullYear() - new Date(acc.cdate).getUTCFullYear())}}});
    }
    return updates;
};

/**@type {AchiModDef[]} */
const achis = [
    {id:"anniversary",description:"Tracks the age of an account.",fields:{"age":"The account age."}}
];

/**@type {AchiHookMod} */
const mod = {
    modId: "anniversary",
    description: "This module provides anniversary achievements.",
    achis,
    handler
};

exports.mod = mod;
