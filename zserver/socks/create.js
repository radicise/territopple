const { NetPayload, NetData, Game } = require("../../defs.js");
const { onGameCreated } = require("../../replayHooks.js");
const { SocketHandler, GlobalState } = require("../types.js");

/**
 * @param {string} dims
 * @param {GlobalState} globals
 * @returns {Record<string,number>|null}
 */
function getDims(dims, globals) {
    if (!dims) return null;
    let parts = dims.split(",");
    if (parts.length < 3) return null;
    parts = parts.map(v => Number(v));
    if (parts.some(v => Number.isNaN(v))) {
        return null;
    }
    return globals.topology.formatDimensions(parts);
}

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    const public = args["type"] === 1;
    const dims = getDims(args["dims"], globals.state);
    const playerCapacity = Number.parseInt(args["players"]);
    const allowSpectators = args["spectators"];
    const useid = args["id"];
    if (!dims || Number.isNaN(playerCapacity)) {
        change("error", {code:1,data:"Invalid Parameters"});
        return;
    }
    state.game = new Game(useid, playerCapacity, {topology:dims,public:public,observable:allowSpectators});
    onGameCreated(state.game, true, 1);
    state.game.addPlayer(sock);
    state.playerNum = 1;
    state.spectating = false;
    state.game.state.hostNum = 1;
    emit("game:add", {id:useid,game:state.game});
    })();
    sock.send(NetData.Player.Ownid(state.playerNum, 1));
    sock.send(NetData.Game.Roomid(state.game.ident));
    change("waiting", {isHost:true});
    return {messageL, closeL, errorL};
};

exports.handler = handler;
