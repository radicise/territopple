const { NetPayload, NetData, getMetatableEntry } = require("../../defs.js");
const { SocketHandler } = require("../types.js");
/**@type {typeof import("../../www/replay/parsers.mjs")} */
let parser;
const loadPromise = new Promise(r => {
    import("../../www/replay/parsers.mjs").then(m => {parser = m;r();});
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
        messageL = (_data, isbinary) => {
            const enotstpl = () => change("error", {data:"not a suspended topple",redirect:"/play-online",store:"not a suspended topple"});
            if (isbinary) {
                if (_data[0] === 0x55 && _data[1] === 0x99) {
                    sock.on("message", (d) => d.suba);
                    const p = new parser.ReplayParser(_data.subarray(2));
                    const head = p.header;
                    if (!head.EXTMETA) {
                        enotstpl();
                        return;
                    }
                    const table = head.metatable;
                    const playerdata = getMetatableEntry(table, "pn__");
                    const stplhead = getMetatableEntry(table, "stpl");
                    if (!(playerdata && stplhead)) {
                        enotstpl();
                        return;
                    }
                    //
                }
            }
            return;
        }
    })();
    return {messageL, closeL, errorL};
};

exports.handler = handler;
