const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (state.spectating || state.game.state.state === 2) {
        if (state.spectating) {
            if (!state.game.spectators[state.spectatorId]) return;
        } else {
            if (!state.game.players[state.playerNum]) return;
        }
        change("leave");
        return;
    }
    if (!state.game.players[state.playerNum]) return;
    state.game.players[state.playerNum].dcon_timer = setTimeout(() => {
        if (state.game.players[state.playerNum] === null) {
            sock.terminate();
            return;
        }
        change("leave", {isHost:args.isHost});
    }, globals.settings.REJOIN_TIME);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
