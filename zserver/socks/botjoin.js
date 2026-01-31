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
    if (game.players[pnum].conn !== null) {
        change("error", {data:"you thought it'd be that easy?"});
        return;
    }
    if (game.players[pnum].rejoin_key !== key) {
        change("error", {data:"you call that locksmith yet?"});
        return;
    }
    clearTimeout(game.players[pnum].timeoutid);
    delete game.players[pnum]["timeoutid"];
    game.players[pnum].conn = sock;
    game.players[pnum].accId = args["a"]||"UNKNOWN";
    state.game = game;
    state.playerNum = pnum;
    const g = game;
    sock.send(NetData.Player.Ownid(state.playerNum, state.game.players[state.playerNum].team));
    sock.send(NetData.Game.Roomid(state.game.ident));
    const cb = () => {
        emit("player:join", {n:state.playerNum, t:state.game.players[state.playerNum].team});
        emit("account:isbot", {n:state.playerNum, a:game.players[pnum].accId});
        change("waiting", {isHost:pnum===g.state.hostNum});
        // if (g.state.state === 0) {
        //     return;
        // }
        // const nkey = g.players[pnum].reKey();
        // sock.send(NetData.Key.Rejoin(nkey, g.ident, pnum));
        // sock.send(NetData.Game.Reconnected());
        // sock.send(NetData.Game.Config(g), () => {
        //     sock.send(NetData.Bin.Board(g), () => {
        //         sock.send(NetData.Game.Rules(g));
        //         sock.send(NetData.Game.Turn(game.state.turn, !game.state.firstTurn));
        //         change("play");
        //     });
        // });
    };
    sock.send(NetData.Game.JList(g), g.res?()=>{
        sock.send(NetData.Bin.Board(g), cb);
    }:cb);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
