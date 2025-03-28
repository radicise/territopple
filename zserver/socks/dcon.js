const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (state.spectating) {
        change("leave");
        return;
    }
    state.game.players[state.playerNum].dcon_timer = setTimeout(() => {
        if (state.game.players[state.playerNum.dcon_timer] === null) {
            sock.terminate();
            return;
        }
        change("leave", {isHost:args.isHost});
    }, 1000);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
