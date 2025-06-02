const { NetPayload, NetData, Random } = require("../../defs.js");
const { onRecordReplay } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    onall("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    onall("game:win", (data) => {
        sock.send(NetData.Game.Win(data["t"]));
        state.game.players[state.playerNum]?.resetTimer(state.game, false);
    });
    onall("player:lose", (data) => {
        sock.send(NetData.Player.Lose(data["n"]));
    });
    onall("game:turn:timeup", (data) => {
        sock.send(NetData.Game.Timeup(data["n"]));
        if (data["n"] !== state.playerNum) return;
        switch (state.game.rules.turnTime.penalty) {
            case "random":{
                const t = state.game.players[state.playerNum].team;
                messageL(`{"type":"game:move","payload":{"n":${Random.choice(state.game.state.teamboard.map((v, i) => (v===0||v===t)?i:null).filter(v => v !== null))}}}`);
                break;
            }
            case "skip":{
                emit("game:turn", {n:state.game.nextPlayer().turn});
                break;
            }
            case "lose":{
                state.game.players[state.playerNum].alive = false;
                emit("player:lose", {n:state.playerNum});
                if (state.game.players.filter(v => v&&v.alive).every((v, _, a) => v.team === a[0].team)) {
                    if (globals.state.saveReplays) {
                        onRecordReplay(state.game);
                    } else {
                        state.game.buffer.push(Buffer.of(0xff, 0xf0, 0x0f, 0xff));
                    }
                    emit("game:turn", {n:state.game.nextPlayer().turn,t:false});
                    emit("game:win", {t:state.game.players[state.game.state.turn].team});
                    state.game.state.state = 2;
                } else {
                    emit("game:turn", {n:state.game.nextPlayer().turn});
                }
                break;
            }
        }
    });
    onall("game:turn", (data) => {
        if (data["n"] === state.playerNum) {
            state.game.players[state.playerNum].resetTimer(state.game, () => {
                // console.log(`TIMEUP: ${state.playerNum}`);
                emit("game:turn:timeup", {n:state.playerNum});
            });
        } else {
            state.game.players[state.playerNum].resetTimer(state.game, false);
        }
        sock.send(NetData.Game.Turn(data["n"], data["t"]));
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
    let allow_ping = true;
    onall("ping", (data) => {
        if (data["n"] === state.playerNum) {
            if (!allow_ping) return;
            allow_ping = false;
            sock.send(NetData.Ping(data["kind"]));
            setTimeout(() => {allow_ping = true;}, globals.settings.PING_INTERVAL);
        }
    });
    // on("spectator:leave", (data) => {
    //     sock.send(NetData.Spectator.Leave(data["n"]));
    // });
    errorL = () => {
        change("dcon");
    };
    sock.on("error", errorL);
    closeL = () => {
        change("dcon");
    };
    sock.on("close", closeL);
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "game:move":{
                if (state.game.validateMove(data.payload["n"], state.playerNum)) {
                    emit("game:out:move", {"n":data.payload["n"],"t":state.game.players[state.playerNum].team});
                    let res = state.game.move(data.payload["n"], state.playerNum);
                    if (res.win) {
                        if (globals.state.saveReplays) {
                            onRecordReplay(state.game);
                        } else {
                            state.game.buffer.push(Buffer.of(0xff, 0xf0, 0x0f, 0xff));
                        }
                        emit("game:win", {t:state.game.players[state.playerNum].team});
                        state.game.state.state = 2;
                    } else {
                        emit("game:turn", {n:res.turn});
                    }
                }
                break;
            }
            case "ping":{
                emit("ping", {n:data.payload.n,kind:data.payload.kind});
                break;
            }
        }
    }
    sock.on("message", messageL);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
