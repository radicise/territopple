const { NetPayload } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    sock.terminate();
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
