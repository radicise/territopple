const { NetPayload, NetData, getMetatableEntry, Game, topology, PerfError, nbytes, Player, settings, fromBytes } = require("../../defs.js");
const { onEvent, onGameCreated, FORMAT_VERSION: FGEN_VERSION, COMPAT_VERSIONS: FGEN_COMPAT, onGameStarted } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");
const crypto = require("crypto");
const http = require("http");
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
    let state_processed = false;
    on("account:found", (data) => {
        if (typeof data["n"] === "number") state.game.players[data["n"]].accId = data["a"];
        sock.send(NetData.Account.Found(data["n"], data["a"]));
    });
    let playerdata;
    messageL = (_data, isbinary) => {
        console.log(_data);
        const enotstpl = () => change("error", {data:"not a suspended topple",redirect:"/play-online",store:"not a suspended topple"});
        if (isbinary) {
            if (state_processed) return;
            if (_data[0] === 0x55 && _data[1] === 0x99) {
                const p = new parser.ReplayParser(_data.subarray(2));
                const head = p.header;
                if (head.version !== FGEN_VERSION && !FGEN_COMPAT.has(head.version)) {
                    change("error", {data:"format version incompatible",redirect:"/play-online",store:"format version incompatible"});
                    return;
                }
                console.log(head);
                if (!head.EXTMETA) {
                    enotstpl();
                    return;
                }
                const table = head.metatable;
                playerdata = p.parser.getMetatableEntry("pn__");
                const stplhead = p.parser.getMetatableEntry("stpl");
                const colors = p.parser.getMetatableEntry("col_");
                if (!(playerdata.length && stplhead.length)) {
                    enotstpl();
                    return;
                }
                if (colors.length) {
                    game.stdmeta.colors = new Array(colors.length/3).fill(0).map((_, i) => fromBytes(colors.subarray(i*3,i*3+3)));
                }
                const stplmeta = new parser.STPLParser(p);
                try {
                    const dims = topology.m.formatDimensions([head.topology_id, ...head.topology_data.params]);
                    console.log(dims);
                    state.game = new Game(args["id"], head.player_count, {topology: topology.m.makeTopology(dims), public: false, observable: args["spectators"]});
                } catch (E) {
                    console.log(E);
                    if (E instanceof PerfError) {
                        change("error", {data:"Not Cute",redirect:"/errors/no-create"});
                        return;
                    } else {
                        change("error", {data:"internal error"});
                        return;
                    }
                }
                console.log(state.game);
                emit("game:add", {id:args["id"],game:state.game});
                const game = state.game;
                onGameCreated(game, true, 1);
                game.addRules(stplmeta.rules);
                const secev_start = p.tell();
                for (let i = 1; i < stplmeta.players.length; i ++) {
                    const pd = stplmeta.players[i];
                    if (pd === null) game.players.push(null);
                    else {
                        const player = new Player(null, head.team_table[i-1]);
                        player.accId = pd.accid;
                        player.botq = pd.botq;
                        player.is_bot = pd.isbot;
                    }
                }
                while (true) {
                    const ev = p.parser.nextEvent();
                    if (ev === null) break;
                    switch (ev.type) {
                        case 0: {
                            if (ev.player === game.state.turn) {
                                game.players[ev.player].alive = false;
                                game.state.turn = game.nextPlayer();
                            }
                            break;
                        }
                        case 1: {
                            game.state.turn = ev.player;
                            game.move(ev.tile, game.state.turn, true);
                            break;
                        }
                    }
                }
                // initialize enough of the header that the event data can be copied in
                onGameStarted(game, head.order_strategy, head.team_table);
                // copy event records into the game's replay buffer
                game.buffer.push(p.raw_data._bytes.subarray(secev_start, p.tell()-4));
                activateplug("stpl");
                invokeplug("stpl", "resume");
                game.state.hostNum = game.players.findIndex(v => v&&v.alive&&!v.is_bot);
                state.playerNum = game.state.hostNum;
                game.players[state.playerNum].conn = sock;
                state.isHost = true;
                for (let i = 1; i < game.players.length; i ++) {
                    const player = game.players[i];
                    if (!player.alive) {
                        game.players[i] = null;
                    } else if (player.is_bot) {
                        const key = crypto.randomBytes(64).toString("base64url");
                        player.rejoin_key = key;
                        const req = http.get(`http://localhost:${settings.BOTPORT}/${game.ident}/${player.botq}?k=${key}&n=${i}`);
                        req.once("response", (res) => {res.on("error", () => {});});
                        req.on("error", () => {});
                        player.timeoutid = setTimeout(() => {
                            game.sendAll(NetData.Player.Leave(i));
                            game.players[i] = null;
                        }, settings.BOT_TO);
                    }
                }
                game.firstTurn = true;
                state_processed = true;
                sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
                sock.send(NetData.Game.Roomid(state.game.ident));
                change("waiting", {isHost:true});
            }
        } else {
            if (!state_processed) {
                return;
            }
            // /**@type {NetPayload} */
            // const data = JSON.parse(_data);
            // switch (data.type) {
            //     case "stpl:start": {
            //         state.game.start();
            //         state.game.setMeta("pn__", playerdata);
            //         change("play");
            //         break;
            //     }
            // }
        }
        return;
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
exports.plugins = plugins;
