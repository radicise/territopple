const { NetPayload, NetData, Game } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    const public = args["type"] === 1;
    const width = Number.parseInt(args["width"]);
    const height = Number.parseInt(args["height"]);
    const playerCapacity = Number.parseInt(args["players"]);
    const allowSpectators = args["spectators"];
    const useid = args["id"];
    if (Number.isNaN(width) || Number.isNaN(height) || Number.isNaN(playerCapacity)) {
        change("error", {code:1,data:"Invalid Parameters"});
        return;
    }
    state.game = new Game(useid, playerCapacity, {rows:height,cols:width,public:public,observable:allowSpectators});
    state.game.addPlayer(sock);
    state.playerNum = 1;
    state.spectating = false;
    state.game.state.hostNum = 1;
    emit("game:add", {id:useid,game:state.game});
    })();
    sock.send(NetData.Player.Ownid(state.playerNum, 1));
    sock.send(NetData.Game.Roomid(state.game.ident));
    change("waiting", {isHost:true});
    return {messageL, closeL, errorL};
};

exports.handler = handler;
