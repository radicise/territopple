const { TTBot, DIFF_LEVELS, Random } = require("./common.js");

// Beginner version of Constantine plays whatever moves get him the most territory
new TTBot("Constantine [the Conqueror] (Beginner)", {
    "desc":"Constantine has great ambitions, but not a lot of skill to make them reality ... *for now*.",
    "diff":DIFF_LEVELS.BEGINNER,
    "disp":"Constantine",
    "prereq":{"achi":[],"bots":["Terry Topple (Trivial)"]}
}, (that, gamestate) => {
    const peval = (tile) => {
        return gamestate.move(tile).owned[gamestate.players[that.pnum].team];
    };
    const _ = gamestate.getMoves().map(v => [v, peval(v)]).sort((a, b) => a[1]-b[1]);
    return Random.pick(_.slice(0, _.findIndex((v, i) => i>0?v[1]<_[i-1][1]:true)));
});
