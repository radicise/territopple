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
    on("?borked", () => {change("error", {data:"borked",redirect:"/play-online",store:"Error, please email the server operator, make sure to include what you were doing before the error occurred."});});
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
    onall("game:kick", (data) => {
        sock.send(NetData.Game.Kick(data["n"]));
        if (data.n===state.spectatorId) {
            state.game.removeSpectator(data.n);
            change("close");
        }
    });
    on("game:export", () => {
        change("error", {data:"Room closed for export",redirect:"/play-online",store:"Room closed for export"});
    });
    on("sync", (data) => {
        sock.send(NetData.Sync(state.game, data["t"]));
    });
    // on("spectator:leave", (data) => {
    //     sock.send(NetData.Spectator.Leave(data["n"]));
    // });
    let mutexflag = false;
    errorL = () => {
        if (mutexflag) return;
        mutexflag = true;
        change("leave");
    };
    closeL = () => {
        if (mutexflag) return;
        mutexflag = true;
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
