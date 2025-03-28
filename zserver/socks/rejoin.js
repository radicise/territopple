const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    let messageL;
    let closeL;
    let errorL;
    (() => {
    /**@type {string} */
    const id = args.id;
    const pnum = Number.parseInt(args.n);
    /**@type {string} */
    const key = args.key;
    if (Number.isNaN(pnum)) {
        change("error", {data:"bad player number"});
        return;
    }
    if (!(id in globals.state.games)) {
        change("error", {data:"game id does not exist"});
        return;
    }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
