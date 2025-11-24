const { TTBot, DIFF_LEVELS, Random, DummyGame, BotConf } = require("./common.js");

// Trivial version of Constantine plays whatever moves get him the most territory
new TTBot("Constantine [the Conqueror] (Trivial)", "constantine", {
    "desc":"Constantine has great ambitions, but not a lot of skill to make them reality ... *for now*.",
    "indexable":true,
    "diff":DIFF_LEVELS.TRIVIAL,
    "disp":"Constantine",
    "prereq":{"achi":[],"bots":["Terry Topple (Trivial)"]}
}, (that, gamestate) => {
    const peval = (tile) => {
        return gamestate.move(tile).owned[gamestate.players[that.pnum].team];
    };
    const _ = gamestate.getMoves().map(v => [v, peval(v)]).sort((a, b) => b[1]-a[1]);
    const ind = _.findIndex((v, i) => i>0?v[1]<_[i-1][1]:false);
    const sub = _.slice(0, ind<0?undefined:ind);
    const p = Random.pick(sub);
    // console.log(`${_}\n${ind}\n${sub}\n${p}`);
    return p[0];
});

const confBGNR = BotConf.getConfig("constantine", DIFF_LEVELS.BEGINNER);
// Beginner version of Constantine that is slightly better
new TTBot("Constantine [the Conqueror] (Beginner)", "constantine", {
    "desc":"Constantine has learned to think ahead, but is still limited in his understanding of others.",
    "indexable":true,
    "diff":DIFF_LEVELS.BEGINNER,
    "disp":"Constantine",
    "prereq":{"achi":[],"bots":["Constantine (Trivial)"]}
}, async (that, gamestate, limit) => {
    let timeup = false;
    /**
     * @param {number} tile
     * @param {number} depth
     * @param {DummyGame} gstate
     * @returns {Promise<number>}
     */
    const peval = async (tile, depth, gstate) => {
        await new Promise(r => setTimeout(r, 0));
        if (depth === 0 || timeup) {
            return gstate.owned[gamestate.players[that.pnum].team];
        }
        const myturn = state.turn === that.pnum;
        const state = gstate.move(tile);
        // state.turn = that.pnum;
        return (myturn?Math.max:Math.min)(...await Promise.all(state.getMoves().map(v => peval(v, depth-1, state))));
    };
    setTimeout(() => {timeup = true;}, limit??confBGNR.maxtime);
    const evals = await Promise.all(gamestate.getMoves().map(async (v) => [v, await peval(v, confBGNR.maxdepth, gamestate)]));
    return Random.pickmove(evals);
});
