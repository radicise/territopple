const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    /**@type {string} */
    const id = args.id;
    const pnum = Number.parseInt(args.n);
    /**@type {string} */
    const key = args.key;
    if (Number.isNaN(pnum)) {
        change("error", {data:"bad player number"});
        return;
    }
    if (!(id in globals.state.games)) {
        change("error", {data:"game id does not exist"});
        return;
    }
    const game = globals.state.games[id];
    if (game.players[pnum].dcon_timer === null) {
        change("error", {data:"not disconnected"});
        return;
    }
    if (game.players[pnum].rejoin_key !== key) {
        change("error", {data:"incorrect key"});
        return;
    }
    clearTimeout(game.players[pnum].dcon_timer);
    game.players[pnum].dcon_timer = null;
    game.players[pnum].conn = sock;
    state.game = game;
    state.playerNum = pnum;
    const g = game;
    sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
    sock.send(NetData.Game.Roomid(state.game.ident));
    sock.send(NetData.Game.JList(g), () => {
        if (g.state.state === 0) {
            change("waiting", {isHost:pnum===g.state.hostNum});
            return;
        }
        const nkey = g.players[pnum].reKey();
        sock.send(NetData.Key.Rejoin(nkey, g.ident, pnum));
        sock.send(NetData.Game.Reconnected());
        sock.send(NetData.Game.Config(g.state.cols, g.state.rows, g.stats.maxPlayers, g.state.hostNum), () => {
            sock.send(NetData.Bin.Board(g), () => {
                sock.send(NetData.Game.Turn(game.state.turn));
                change("play");
            });
        });
    });
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
