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
    const useid = args["id"];
    if (Number.isNaN(width) || Number.isNan(height) || Number.isNaN(playerCapacity)) {
        change("error", {code:1,data:"Invalid Parameters"});
        return;
    }
    state.game = new Game(useid, players, {rows:height,cols:width,public:public,observable:true});
    state.game.addPlayer(sock);
    state.playerNum = 1;
    state.spectating = false;
    emit("game:add", {id:useid,game:state.game});
    })();
    sock.send(NetData.Player.Ownid(state.playerNum));
    sock.send(NetData.Game.Roomid(state.game.ident));
    change("waiting", {isHost:true});
    return {messageL, closeL, errorL};
};

exports.handler = handler;
