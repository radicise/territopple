const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    let isHost = args.isHost ?? false;
    // if (isHost) {
    //     sock.send(NetData.Waiting.Promote(state.playerNum));
    // }
    {
        const g = state.game;
        sock.send(NetData.Game.Config(g.state.cols,g.state.rows,g.stats.maxPlayers,g.state.hostNum));
    }
    on("waiting:promote", (data) => {
        // sock.send("waiting:promote");
        sock.send(NetData.Waiting.Promote(data["n"]));
        if (data.n === state.playerNum) {
            isHost = true;
        }
    });
    on("waiting:start", (data) => {
        // sock.send("waiting:start");
        sock.send(NetData.Waiting.Start());
        if (state.spectating) {
            change("spectating");
        } else {
            sock.send(NetData.Game.Turn(state.game.state.turn));
            change("play");
        }
    });
    on("waiting:kick", (data) => {
        sock.send(NetData.Waiting.Kick(data["n"]));
        if (state.spectating?(data.n===state.spectatorId):(data.n===state.playerNum)) {
            change("close");
        }
    });
    on("player:spectate", (data) => {
        sock.send(NetData.Player.Spectate(data["n"], data["id"]));
    });
    on("player:join", (data) => {
        sock.send(NetData.Player.Join(data["n"]));
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
        if (state.spectating) {
            switch (data.type) {
                case "waiting:leave":
                    change("leave");
                    break;
            }
            return;
        }
        switch (data.type) {
            case "waiting:kick":
                if (isHost) {
                    state.game.start();
                    emit("waiting:kick", {n:data["n"]});
                }
                break;
            case "waiting:start":
                if (isHost) {
                    emit("waiting:start");
                }
                break;
            case "waiting:leave":
                change("leave", {isHost});
                break;
            case "player:spectate":
                state.spectating = true;
                state.spectatorId = state.game.addSpectator(sock);
                state.game.removePlayer(state.playerNum);
                emit("player:spectate", {n:state.playerNum, id:state.spectatorId});
                delete state["playerNum"];
                if (isHost) {
                    isHost = false;
                    emit("waiting:need-promote");
                }
                // on(`#META:${state.tag}`, (data) => {
                //     state.spectating = true;
                //     state.spectatorId = data["#id"];
                //     delete state["playerNum"];
                //     change("spectating");
                // });
                break;
        }
    };
    sock.on("message", messageL);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
