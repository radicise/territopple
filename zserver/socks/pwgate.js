/**
 * @file
 * acts as a gate for password protected rooms
 */
const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    const pw = globals.state.games[args["id"]]?.password;
    if (typeof pw !== "string") {
        change(args["to"], args);
        return;
    }
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        if (data.type === "game:password") {
            if (data.payload["pw"] === pw) {
                change(args["to"], args);
                return;
            } else {
                change("error", {"data":"Wrong Password", "redirect":"/play-online", "store":"Wrong Password"});
                return;
            }
        }
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
