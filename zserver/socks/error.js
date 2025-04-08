const { NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    emit("error", args);
    if (args.data) {
        sock.send(NetData.Error(0, args.data, {redirect:args.redirect,store:args.store}));
        // sock.close(args["code"], args["data"]);
    } else {
        sock.send(NetData.Error(0));
        // sock.close(0);
    }
    setTimeout(sock.terminate, 125);
    return {messageL, closeL, errorL};
};

exports.handler = handler;
