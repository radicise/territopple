const { AchiHookMod, AchiStateMod, AchiModDef, AchiModFunc } = require("../types.js");
const mdb = require("mongodb");

/**@type {AchiModFunc} */
const handler = (hook, acc, data) => {
    /**@type {AchiStateMod[]} */
    const updates = [];
    if (hook === "init" || hook === "scan.periodic") {
        const cdate = new Date(acc.cdate);
        const ndate = new Date();
        const cmon = cdate.getUTCMonth(), nmon = ndate.getUTCMonth();
        const cday = cdate.getUTCDate(), nday = ndate.getUTCDate();
        const cyear = cdate.getUTCFullYear(), nyear = ndate.getUTCFullYear();
        let age = nyear - cyear;
        if (cmon > nmon) {
            age -= 1;
        } else if (cmon === nmon) {
            if (cday > nday) {
                age -= 1;
            }
        }
        if (age < 0) age = 0;
        updates.push({id:"anniversary",fields:{age:{op:"set",value:new mdb.Int32(age)}}});
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
