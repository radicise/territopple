const { Game, NetData, NetPayload } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    /**@type {string} */
    const rgameId = args["id"];
    if (!(rgameId in globals.state.games)) {
        change("error", {code:1,data:"game id does not exist"});
        return;
    }
    const game = globals.state.games[rgameId];
    if (args.asSpectator??false) {
        state.spectating = true;
        state.spectatorId = game.addSpectator(sock);
        sock.send(NetData.Spectator.Ownid(state.spectatorId));
        sock.send(NetData.Game.Roomid(state.game.ident));
        emit("spectator:join", {n:state.spectatorId});
        change("waiting");
        return;
    }
    if (game.state.state !== 0) {
        change("error", {code:2,data:"game in progress"});
        return;
    }
    state.game = game;
    state.playerNum = game.addPlayer(sock);
    sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
    sock.send(NetData.Game.Roomid(state.game.ident));
    emit("player:join", {n:state.playerNum, t:state.game.players[state.playerNum].team});
    change("waiting");
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
