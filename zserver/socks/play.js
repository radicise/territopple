const { NetPayload, NetData, Random, settings } = require("../../defs.js");
const { onRecordReplay, onPlayerRemoved } = require("../../replayHooks.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    on("?borked", () => {change("error", {data:"borked",redirect:"/play-online",store:"Error, please email the server operator, make sure to include what you were doing before the error occurred."});});
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
                    onRecordReplay(state.game, {suppress_write:!globals.state.saveReplays});
                    state.game.__ended = state.game.buffer.length;
                    emit("game:turn", {n:state.game.nextPlayer().turn,t:false});
                    state.game.state.state = 2;
                    emit("?phase");
                    emit("game:win", {t:state.game.players[state.game.state.turn].team});
                } else {
                    emit("game:turn", {n:state.game.nextPlayer().turn});
                }
                break;
            }
        }
    });
    onall("game:turn", (data) => {
        if (!state.game.players[state.playerNum]) {
            emit("?borked");
            change("error", {data:"borked",redirect:"/play-online",store:"Error, please email the server operator, make sure to include what you were doing before the error occurred."});
            return;
        }
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
    onall("game:kick", (data) => {
        sock.send(NetData.Game.Kick(data["n"]));
        if (data.n===state.playerNum) {
            onPlayerRemoved(state.game, state.playerNum);
            state.game.removePlayer(data.n);
            change("close");
        }
    });
    on("game:export", () => {
        change("error", {data:"Room closed for export",redirect:"/play-online",store:"Room closed for export"});
    });
    onall("game:pause", () => {
        sock.send(NetData.Game.Pause((state.game.players[state.game.state.turn]??{})[state.game.rules.turnTime.style==="chess"?"time_left":"res_time"]??0));
    });
    onall("game:resume", () => {
        sock.send(NetData.Game.Resume());
    });
    onall("sync", (data) => {
        sock.send(NetData.Sync(state.game, data["t"]));
    });
    // on("spectator:leave", (data) => {
    //     sock.send(NetData.Spectator.Leave(data["n"]));
    // });
    let mutexflag = false;
    errorL = () => {
        if (mutexflag) return;
        mutexflag = true;
        change("dcon");
    };
    closeL = () => {
        if (mutexflag) return;
        mutexflag = true;
        change("dcon");
    };
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "game:pause":{
                if (state.isHost) {
                    state.game.pauseTimers();
                    emit("game:pause");
                    emit("sync", {t:"time"});
                }
                break;
            }
            case "game:resume":{
                if (state.isHost) {
                    emit("game:resume");
                    state.game.resumeTimers();
                }
                break;
            }
            case "game:export":{
                if (state.isHost) {
                    state.game.stopTimers();
                    state.game.addExportMeta();
                    onRecordReplay(state.game, {suppress_write:true});
                    state.game.__ended = state.game.buffer.length;
                    sock.send(NetData.Bin.Export(state.game));
                }
                break;
            }
            case "game:download":{
                sock.send(NetData.Bin.Replay(state.game));
                break;
            }
            case "game:kick":{
                if (state.isHost) {
                    emit("game:kick", {n:data.payload["n"]});
                }
                break;
            }
            case "game:move":{
                if (state.game.validateMove(data.payload["n"], state.playerNum)) {
                    emit("game:out:move", {"n":data.payload["n"],"t":state.game.players[state.playerNum].team});
                    let res = state.game.move(data.payload["n"], state.playerNum);
                    if (res.win) {
                        onRecordReplay(state.game, {suppress_write:!globals.state.saveReplays});
                        state.game.__ended = state.game.buffer.length;
                        state.game.state.state = 2;
                        emit("?phase");
                        emit("game:win", {t:state.game.players[state.playerNum].team,d:settings.REPLAYS.ENABLED});
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
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
