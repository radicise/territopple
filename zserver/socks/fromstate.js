const { NetPayload, NetData } = require("../../defs.js");
const { SocketHandler } = require("../types.js");
/**@type {typeof import("../../www/replay/parsers.js")} */
let parser;
const loadPromise = new Promise(r => {
    import("../../www/replay/parsers.js").then(m => {parser = m;r();});
});

/**@type {SocketHandler} */
const handler = (sock, globals, {change, emit, onall, on}, args, state) => {
    if (!parser) {
        return {invokeError:"server is still spinning up, try again shortly"};
    }
    let messageL;
    let closeL;
    let errorL;
    (() => {
        //
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
