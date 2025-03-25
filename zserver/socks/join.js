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
    console.log(rgameId);
    if (!(rgameId in globals.state.games)) {
        change("error", {code:1,data:"game id does not exist"});
        return;
    }
    const game = globals.state.games[rgameId];
    const pack = NetData.Game.JList(game.players.map((v, i) => v ? [i, v.team] : null).filter(v => v !== null), Object.keys(game.spectators));
    if (args.asSpectator??false) {
        if (!game.state.observable) {
            change("error", {data:"spectators aren't allowed in this room"});
            return;
        }
        state.game = game;
        state.spectating = true;
        state.spectatorId = game.addSpectator(sock);
        sock.send(NetData.Spectator.Ownid(state.spectatorId));
        sock.send(NetData.Game.Roomid(state.game.ident));
        sock.send(pack);
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
    sock.send(pack);
    emit("player:join", {n:state.playerNum, t:state.game.players[state.playerNum].team});
    change("waiting");
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
