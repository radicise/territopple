const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    {
        const g = state.game;
        sock.send(NetData.Game.Config(g.state.cols,g.state.rows,g.stats.maxPlayers,g.state.hostNum), () => {
            sock.send(NetData.Bin.Board(g), {"binary":true});
        });
    }
    on("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    on("player:spectate", (data) => {
        sock.send(NetData.Player.Spectate(data["n"], data["id"]));
    });
    // on("player:leave", (data) => {
    //     sock.send(NetData.Player.Leave(data["n"]));
    // });
    on("spectator:join", (data) => {
        sock.send(NetData.Spectator.Join(data["n"]));
    });
    // on("spectator:leave", (data) => {
    //     sock.send(NetData.Spectator.Leave(data["n"]));
    // });
    errorL = () => {
        change("leave");
    };
    sock.on("error", errorL);
    closeL = () => {
        change("leave");
    };
    sock.on("close", closeL);
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "spectator:leave":
                change("leave");
                break;
        }
    }
    sock.on("message", messageL);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
