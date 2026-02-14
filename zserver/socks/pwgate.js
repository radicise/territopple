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
    // console.log(args["id"]);
    // console.log(pw);
    if (typeof pw !== "string") {
        // console.log("NO PASS");
        change(args["to"], args);
        return;
    }
    messageL = (_data) => {
        /**@type {NetPayload} */
        const data = JSON.parse(_data);
        if (data.type === "game:password") {
            console.log(`${data.payload['pw']} = ${pw}?`);
            if (data.payload["pw"] === pw) {
                // console.log("GOOD");
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
