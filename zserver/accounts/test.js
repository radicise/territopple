const { getCurves, getCiphers } = require("crypto");
const { AccountId, AuthToken, SensitiveData } = require("./common.js");
const { createQuickAuthToken, verifyQuickAuthToken } = require("./auth.js");

console.log(getCurves());
console.log(getCiphers());

const tok = createQuickAuthToken(new AccountId(10)).encrypt((data)=>data);
console.log(tok);
console.log(verifyQuickAuthToken(tok.data));
setTimeout(()=>{console.log(verifyQuickAuthToken(tok.data));}, 16000);
setTimeout(()=>{console.log(verifyQuickAuthToken(tok.data));}, 31000);
