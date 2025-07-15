const { TTBot, ThinkFunction, BotInfo, DIFFICULTY, DIFF_LEVELS } = require("./common.js");


const _trivial_moves = [0,0];
new TTBot("Terry Topple (Trivial)", {
    "desc":"Terry Topple loves seeing new players get into the game and wants to make the learning experience as smooth as possible.",
    "diff":DIFF_LEVELS.TRIVIAL,
    "disp":"Terry Topple",
    "prereq":{"achi":[],"bots":[]}
}, (that, gamestate) => {
    if (!that.count) {
        that.count = 0;
    }
    if (that.count > 1) {
        throw new Error("tutorial should be over");
    }
    return _trivial_moves[that.count++];
});
