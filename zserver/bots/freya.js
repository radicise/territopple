const { TTBot, DIFF_LEVELS, Random } = require("./common.js");

// Beginner version of Constantine plays whatever moves get him the most territory
new TTBot("Freya [the Foresighted] (Moderate)", "freya", {
    "desc":"Freya has foresight, and has learned a few tricks.",
    "indexable":true,
    "diff":DIFF_LEVELS.MODERATE,
    "disp":"Freya",
    "prereq":{"achi":[],"bots":["Terry Topple (Trivial)"]}
}, (that, gamestate) => {
    const peval = (tile, depth, cscore) => {
        const state = gamestate.move(tile);
        if (depth === 0) {}
        return gamestate.move(tile).owned[gamestate.players[that.pnum].team];
    };
    const _ = gamestate.getMoves().map(v => [v, peval(v, 4, 0)]).sort((a, b) => b[1]-a[1]);
    const ind = _.findIndex((v, i) => i>0?v[1]<_[i-1][1]:false);
    const sub = _.slice(0, ind<0?undefined:ind);
    const p = Random.pick(sub);
    // console.log(`${_}\n${ind}\n${sub}\n${p}`);
    return p[0];
});
