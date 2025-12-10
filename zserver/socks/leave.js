const { NetPayload } = require("../../defs.js");
const { onPlayerRemoved } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (!state.spectating) {
        if (state.game.state.state !== 0) {
            onPlayerRemoved(state.game, state.playerNum);
            state.game.removePlayer(state.playerNum);
            if (state.game.state.turn === state.playerNum) {
                const res = state.game.nextPlayer();
                emit("game:turn", {n:res.turn});
            }
        } else {
            state.game.removePlayer(state.playerNum);
        }
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
