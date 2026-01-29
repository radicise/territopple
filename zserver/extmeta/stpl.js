const { NetPayload, NetData, getMetatableEntry, Game, topology, PerfError, nbytes } = require("../../defs.js");
const { onEvent } = require("../../replayHooks.js");
const { PluginModule } = require("../types.js");

/**@type {Record<string,{game:Game}&Record<string,any>>} */
const gamedata = {};

/**@type {PluginModule} */
const plugin = {
    initlisten: ({on, emit, emitraw, _tag}) => {
        on("@deactivate", (data) => {delete gamedata[data["#gameid"]];});
    },
    activate: (state, {on, emit, emitraw, _tag}) => {
        if (state.game.ident in gamedata) return;
        gamedata[state.game.ident] = {game:state.game};
        const game = state.game;
        game.extendEvent(3,{name:"stpl:*",condition:null,size:1},(game,a)=>Buffer.of(Math.max(["stpl:!","stpl:suspend","stpl:resume"].indexOf(a[0]),0)),2);
        game.extendEvent(3,{name:"stpl:&",condition:["stpl:*",'>',0],size:8},()=>Buffer.from(nbytes(Date.now(), 8)),2);
    },
    resume: (state, _) => {
        onEvent(state.game, 3, "stpl:resume");
    },
    suspend: (state, _) => {
        onEvent(state.game, 3, "stpl:suspend");
    }
};

exports.plugin = plugin;
