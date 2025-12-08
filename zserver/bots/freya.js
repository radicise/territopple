const { TTBot, DIFF_LEVELS, Random, DummyGame, BotConf } = require("./common.js");

// Moderate version of Freya looks ridiculously far into the future
new TTBot("Freya [the Foresighted] (Moderate)", "freya", {
    "desc":"Freya has foresight, and has learned a few tricks.",
    "indexable":true,
    "diff":DIFF_LEVELS.MODERATE,
    "disp":"Freya",
    "prereq":{"achi":[],"bots":["Terry Topple (Trivial)"]}
}, async (that, gamestate, limit) => {
    let timeup = false;
    const starttime = Date.now();
    // let best = Number.NEGATIVE_INFINITY;
    /**
     * @param {number} tile
     * @param {number} depth
     * @param {DummyGame} gstate
     * @returns {number}
     */
    const peval = async (tile, depth, gstate) => {
        await new Promise(r => setTimeout(r, 1));
        // console.log(`DT: ${Date.now() - starttime}`);
        if (depth === 0 || timeup) {
            return gstate.owned[gamestate.players[that.pnum].team]-(
                gstate.topology.tileCount
                -gstate.owned[0]
                // -gstate.owned[gamestate.players[that.pnum].team]
            );
        }
        const myturn = gstate.turn === that.pnum;
        const state = gstate.move(tile);
        if (state.owned.some(v => v===gstate.topology.tileCount)) {
            return myturn?Number.POSITIVE_INFINITY:Number.NEGATIVE_INFINITY;
        }
        // state.turn = that.pnum;
        const res = (myturn?Math.max:Math.min)(...await Promise.all(state.getMoves().map(v => peval(v, depth-1, state))));
        delete state;
        return res;
    };
    setTimeout(() => {timeup = true;}, limit??that.conf.maxtime);
    const evals = await Promise.all(gamestate.getMoves().map(async (v) => [v, await peval(v, that.conf.maxdepth, gamestate)]));
    return Random.pickmove(evals);
});
