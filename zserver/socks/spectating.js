const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    on("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    on("player:spectate", (data) => {
        sock.send(NetData.Player.Spectate(data["n"], data["id"]));
    });
    on("player:leave", (data) => {
        sock.send(NetData.Player.Leave(data["n"]));
    });
    on("spectator:join", (data) => {
        sock.send(NetData.Spectator.Join(data["n"]));
    });
    on("spectator:leave", (data) => {
        sock.send(NetData.Spectator.Leave(data["n"]));
    });
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
