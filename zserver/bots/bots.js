const { TTBot, TTBotInstance } = require("./common.js");
const fs = require("fs");

fs.readdirSync(__dirname).filter(v => !(v.startsWith("bots") || v.startsWith("common") || v.startsWith("bot_server"))&&v.endsWith(".js")).forEach(v => require(`./${v}`));

exports.TTBot = TTBot;
exports.TTBotInstance = TTBotInstance;
