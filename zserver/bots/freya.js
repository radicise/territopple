const { TTBot, DIFF_LEVELS, Random, DummyGame, BotConf } = require("./common.js");

// Moderate version of Freya looks ridiculously far into the future
new TTBot("Freya [the Foresighted] (Moderate)", "freya", {
    "desc":"Freya has foresight, and has learned a few tricks.",
    "indexable":true,
    "diff":DIFF_LEVELS.MODERATE,
    "disp":"Freya",
    "prereq":{"achi":[],"bots":["Terry Topple (Trivial)"]}
}, async (that, gamestate, limit) => {
    limit = Math.min(limit ?? that.conf.maxtime, that.conf.maxtime);
    let timeup = false;
    const starttime = Date.now();
    let count = 0;
    // let best = Number.NEGATIVE_INFINITY;
    /**
     * @param {number} tile
     * @param {number} depth
     * @param {DummyGame} gstate
     * @returns {Promise<number>}
     */
    const peval = async (tile, depth, gstate) => {
        count ++;
        if (depth === 0 || timeup || Date.now()-starttime > limit) {
            if (!timeup) console.log("TIMEOUT");
            timeup = true;
            return gstate.getOwned(that.pnum)-(
                gstate.topology.tileCount
                -gstate.getOwned(0)
                // -gstate.owned[gamestate.players[that.pnum].team]
            );
        }
        // await new Promise(r => setTimeout(r, 1));
        // console.log(`DT: ${Date.now() - starttime}`);
        const myturn = gstate.turn === that.pnum;
        const state = gstate.move(tile);
        if (state.win) {
            return myturn?Number.POSITIVE_INFINITY:Number.NEGATIVE_INFINITY;
        }
        // state.turn = that.pnum;
        const l = [];
        for (const move of state.getMoves()) {
            l.push(await peval(move, depth-1, state));
        }
        const res = (myturn?Math.max:Math.min)(...l);
        return res;
    };
    // setTimeout(() => {timeup = true;}, limit??that.conf.maxtime);
    const evals = [];
    for (const move of gamestate.getMoves()) {
        evals.push([move, await peval(move, that.conf.maxdepth, gamestate)]);
    }
    return Random.pickmove(evals);
});
