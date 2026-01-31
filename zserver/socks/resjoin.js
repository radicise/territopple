const { NetPayload, NetData } = require("../../defs.js");
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
    if (game.stats.playing + game.stats.reservedSlots >= game.stats.maxPlayers) {
        change("error", {data:"room is full",redirect:"/play-online",store:"room is full"});
        return;
    }
    if (game.state.state !== 0) {
        change("error", {code:2,data:"game in progress",redirect:"/play-online",store:"game in progress"});
        return;
    }
    state.game = game;
    sock.send(NetData.ResJoin.Available(game));
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        if (data.type === "resjoin:select") {
            /**@type {number} */
            const n = data.payload["n"];
            if (!game.players[n]) {
                sock.send(NetData.ResJoin.Available(game));
                return;
            }
            if (!game.players[n].alive || game.players[n].is_bot || game.players[n].conn) {
                sock.send(NetData.ResJoin.Available(game));
                return;
            }
            sock.send(JSON.stringify({type:"resjoin:select",payload:{}}));
            game.players[n].conn = sock;
            state.playerNum = n;
            state.game.players[state.playerNum].accId = state.accId;
            if (args.isHost) {
                game.state.hostNum = n;
            }
            game.stats.connected ++;
            game.stats.playing ++;
            sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
            sock.send(NetData.Game.Roomid(state.game.ident));
            sock.send(NetData.Game.JList(game));
            sock.send(NetData.Bin.Board(game), () => {
                emit("player:join", {n:state.playerNum, t:state.game.players[state.playerNum].team});
                change("waiting", {isHost:args.isHost, res:args.res});
            });
        }
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
