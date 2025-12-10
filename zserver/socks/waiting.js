const { NetPayload, NetData } = require("../../defs.js");
const { onGameStarted } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    state.isHost = args.isHost ?? false;
    // if (state.isHost) {
    //     sock.send(NetData.Waiting.Promote(state.playerNum));
    // }
    {
        const g = state.game;
        if (!state.spectating) {
            sock.send(NetData.Key.Rejoin(g.players[state.playerNum].rejoin_key, g.ident, state.playerNum));
        }
        sock.send(NetData.Game.Config(g), () => {
            // sock.send(NetData.Bin.Board(state.game), {"binary":true});
        });
        sock.send(NetData.Game.Rules(g));
        // sock.send(Buffer.of(10,10), {"binary":true});
        // for (let i = 0; i < g.players.length; i ++) {
        //     if (g.players[i]) {
        //         if (g.players[i].ready) {
        //             sock.send(NetData.Waiting.SetReady(i, g.players[i].ready));
        //         }
        //         // sock.send(NetData.Player.Join(i, g.players[i].team));
        //     }
        // }
    }
    // onall("waiting:setready", (data) => {
    //     sock.send(NetData.Waiting.SetReady(data["n"], data["r"]));
    // });
    onall("waiting:promote", (data) => {
        // sock.send("waiting:promote");
        sock.send(NetData.Waiting.Promote(data["n"]));
        if (data.n === state.playerNum) {
            state.isHost = true;
        }
    });
    onall("waiting:start", (data) => {
        // sock.send("waiting:start");
        sock.send(NetData.Waiting.Start());
        if (state.spectating) {
            change("spectating", {waited:true});
        } else {
            sock.send(NetData.Game.Turn(state.game.state.turn, false));
            change("play");
        }
    });
    onall("game:kick", (data) => {
        sock.send(NetData.Game.Kick(data["n"]));
        if (state.spectating?(data.n===state.spectatorId):(data.n===state.playerNum)) {
            if (state.spectating) {
                state.game.removeSpectator(data.n);
            } else {
                state.game.removePlayer(data.n);
            }
            change("close");
        }
    });
    on("player:spectate", (data) => {
        sock.send(NetData.Player.Spectate(data["n"], data["id"]));
    });
    on("player:join", (data) => {
        sock.send(NetData.Player.Join(data["n"], data["t"]));
    });
    // on("player:leave", (data) => {
    //     sock.send(NetData.Player.Leave(data["n"]));
    // });
    on("spectator:join", (data) => {
        sock.send(NetData.Spectator.Join(data["n"]));
    });
    let allow_ping = true;
    onall("ping", (data) => {
        if (data["n"] === state.playerNum) {
            if (!allow_ping) return;
            allow_ping = false;
            sock.send(NetData.Ping(data["kind"]));
            setTimeout(() => {allow_ping = true;}, globals.settings.PING_INTERVAL);
        }
    });
    onall("account:found", (data) => {
        sock.send(NetData.Account.Found(data["n"], data["a"]));
    });
    if (state.accId) {
        emit("account:found", {n:(state.spectating?state.spectatorId:state.playerNum), a:state.accId});
        state.game.updateAccountId(state.spectating?state.spectatorId:state.playerNum, state.accId);
    }
    // on("spectator:leave", (data) => {
    //     sock.send(NetData.Spectator.Leave(data["n"]));
    // });
    errorL = () => {
        change("dcon", {isHost:state.isHost});
    };
    closeL = () => {
        change("dcon", {isHost:state.isHost});
    };
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
            // case "waiting:setready":
            //     emit("waiting:setready", {n:state.playerNum,r:data.payload["r"]});
            //     break;
            case "game:bot":
                if (state.isHost) {
                    emit("game:bot", {bot:data.payload["bot"]});
                }
                break;
            case "game:kick":
                if (state.isHost) {
                    emit("game:kick", {n:data.payload["n"]});
                }
                break;
            case "waiting:start":
                if (state.isHost) {
                    onGameStarted(state.game, 0, state.game.players.slice(1).map(v => v?v.team:0));
                    state.game.start();
                    emit("?phase");
                    emit("waiting:start");
                }
                break;
            case "waiting:leave":
                change("leave", {isHost});
                break;
            case "waiting:promote":
                if (state.isHost) {
                    /**@type {number} */
                    const n = data.payload["n"];
                    if (n === state.playerNum) return;
                    if (n > 0 && n < state.game.players.length && state.game.players[n]) {
                        state.game.state.hostNum = n;
                        emit("waiting:promote", {n});
                    }
                }
                break;
            case "player:spectate":
                state.spectating = true;
                state.spectatorId = state.game.addSpectator(sock);
                state.game.removePlayer(state.playerNum);
                emit("player:spectate", {n:state.playerNum, id:state.spectatorId});
                delete state["playerNum"];
                if (state.isHost) {
                    state.isHost = false;
                    emit("waiting:need-promote");
                }
                // on(`#META:${state.tag}`, (data) => {
                //     state.spectating = true;
                //     state.spectatorId = data["#id"];
                //     delete state["playerNum"];
                //     change("spectating");
                // });
                break;
            case "ping":{
                emit("ping", {n:data.payload.n,kind:data.payload.kind});
                break;
            }
        }
    };
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
