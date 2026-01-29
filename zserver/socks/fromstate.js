const { NetPayload, NetData, getMetatableEntry, Game, topology, PerfError, nbytes } = require("../../defs.js");
const { onEvent } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");
/**@type {typeof import("../../www/replay/parsers.mjs")} */
let parser;
const loadPromise = new Promise(r => {
    import("../../www/replay/parsers.mjs").then(m => {parser = m;r();});
});

const plugins = ["stpl"];

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on, activateplug, invokeplug}, args, state) => {
    if (!parser) {
        return {invokeError:"server is still spinning up, try again shortly"};
    }
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (args["acc"]) {
        state.accId = args["acc"];
    }
    messageL = (_data, isbinary) => {
        const enotstpl = () => change("error", {data:"not a suspended topple",redirect:"/play-online",store:"not a suspended topple"});
        if (isbinary) {
            if (_data[0] === 0x55 && _data[1] === 0x99) {
                sock.on("message", (d) => d.suba);
                const p = new parser.ReplayParser(_data.subarray(2));
                const head = p.header;
                if (!head.EXTMETA) {
                    enotstpl();
                    return;
                }
                const table = head.metatable;
                const playerdata = getMetatableEntry(table, "pn__");
                const stplhead = getMetatableEntry(table, "stpl");
                if (!(playerdata && stplhead)) {
                    enotstpl();
                    return;
                }
                const stplmeta = new parser.STPLParser(p);
                try {
                    state.game = new Game(args["id"], head.player_count, {topology: topology.m.makeTopology(topology.m.formatDimensions([head.topology_id, ...head.topology_data.params])), public: args["public"], observable: args["observable"]});
                } catch (E) {
                    if (E instanceof PerfError) {
                        change("error", {data:"Not Cute",redirect:"/errors/no-create"});
                        return;
                    }
                }
                onGameCreated(state.game, true, 1);
                state.game.addRules(stplmeta.rules);
                activateplug("stpl");
                invokeplug("stpl", "resume");
            }
        }
        return;
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
exports.plugins = plugins;
