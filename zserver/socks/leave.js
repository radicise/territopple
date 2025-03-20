const { NetPayload } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (!state.spectating) {
        state.game.removePlayer(state.playerNum);
        emit("player:leave", {n:state.playerNum});
        if (args.isHost??false) {
            emit("waiting:need-promote");
        }
    } else {
        state.game.removeSpectator(state.spectatorId);
        emit("spectator:leave", {n:state.spectatorId});
    }
    sock.terminate();
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
