const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    // change("error", {code:1, data:"TODO"});
    on("game:out:move", (data) => {
        sock.send(NetData.Game.Move(data["n"], data["t"]));
    });
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        switch (data.type) {
            case "game:move":{
                if (state.game.validateMove(data.payload["n"], state.playerNum)) {
                    state.game.move(data.payload["n"], state.playerNum);
                    emit("game:out:move", {"n":data["n"],"t":state.playerNum});
                }
            }
        }
    }
    sock.on("message", messageL);
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
