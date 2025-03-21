const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    // change("error", {code:1, data:"TODO"});
    onall("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    onall("game:win", (data) => {
        sock.send(NetData.Game.Win(data["t"]))
    });
    onall("game:turn", (data) => {
        sock.send(NetData.Game.Turn(data["n"]));
    });
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "game:move":{
                if (state.game.validateMove(data.payload["n"], state.playerNum)) {
                    emit("game:out:move", {"n":data["n"],"t":state.playerNum});
                    let res = state.game.move(data.payload["n"], state.playerNum);
                    if (res.win) {
                        emit("game:win", {t:state.game.players[state.playerNum].team});
                    } else {
                        emit("game:turn", {n:res.turn});
                    }
                }
            }
        }
    }
    sock.on("message", messageL);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
