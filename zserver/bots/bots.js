const { TTBot } = require("./common.js");
const fs = require("fs");

fs.readdirSync(__dirname).filter(v => !(v.startsWith("bots") || v.startsWith("common"))).forEach(v => require(`./${v}`));

exports.TTBot = TTBot;
