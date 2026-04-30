const { ACHIEVEMENTS, ACTIONS } = require("../zserver/accounts/achi/data.js");

const replacer = (key,value)=>typeof value==="bigint"?`\\!b${value}`:value;
console.log(JSON.stringify(ACTIONS,replacer));
console.log(JSON.stringify(ACHIEVEMENTS,replacer));

