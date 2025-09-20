const { Game, NetData, NetPayload } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (args["acc"]) {
        state.accId = args["acc"];
    }
    /**@type {string} */
    const rgameId = args["id"];
    // console.log(rgameId);
    if (!(rgameId in globals.state.games)) {
        change("error", {code:1,data:"game id does not exist",redirect:"/play-online",store:"game id does not exist"});
        return;
    }
    const game = globals.state.games[rgameId];
    const pack = NetData.Game.JList(game);
    if (args.asSpectator??false) {
        if (!game.state.observable) {
            change("error", {data:"spectators aren't allowed in this room",redirect:"/play-online",store:"spectators aren't allowed in this room"});
            return;
        }
        state.game = game;
        state.spectating = true;
        state.spectatorId = game.addSpectator(sock);
        sock.send(NetData.Spectator.Ownid(state.spectatorId));
        sock.send(NetData.Game.Roomid(state.game.ident));
        sock.send(pack);
        emit("spectator:join", {n:state.spectatorId});
        if (game.state.state === 0) {
            change("waiting");
        } else {
            change("spectating");
        }
        return;
    }
    if (game.stats.playing + game.stats.reservedSlots >= game.stats.maxPlayers) {
        change("error", {data:"room is full",redirect:"/play-online",store:"room is full"});
        return;
    }
    if (game.state.state !== 0) {
        change("error", {code:2,data:"game in progress",redirect:"/play-online",store:"game in progress"});
        return;
    }
    state.game = game;
    state.playerNum = game.addPlayer(sock);
    sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
    sock.send(NetData.Game.Roomid(state.game.ident));
    sock.send(pack);
    emit("player:join", {n:state.playerNum, t:state.game.players[state.playerNum].team});
    change("waiting");
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
