const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    if (!args.waited) {
        const g = state.game;
        sock.send(NetData.Game.Rules(g), () => {
            sock.send(NetData.Game.Config(g), () => {
                sock.send(NetData.Bin.Board(g), {"binary":true});
            });
        });
    }
    on("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    on("game:turn:timeup", (data) => {
        sock.send(NetData.Game.Timeup(data["n"]));
    });
    on("player:lose", (data) => {
        sock.send(NetData.Player.Lose(data["n"]));
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
    closeL = () => {
        change("leave");
    };
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "spectator:leave":
                change("leave");
                break;
        }
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
