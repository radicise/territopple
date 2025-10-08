/**
 * @file
 * easy way to load various common parsers
 */

/**@type {Record<string,object>} */
const modcache = {};

/**
 * @typedef {{topo?:import("../../topology/topology.js").Topology,flags:number}} ParserContext
 */

/**
 * @typedef ParserFunction
 * @type {(stream:Uint8Array,context:ParserContext)}
 */

class ParserClass {
    /**
     * @param {Uint8Array} stream
     * @param {ParserContext} context
     */
    constructor(stream, context) {}
    /**
     * may only be called before `next`, returns `null` if there is no header
     * @returns {object|null}
     */
    header() {}
    /**
     * may be called once `next` returns `null`, contains data organized in a similar manner to the header
     * returns `null` if there is no trailer
     * @returns {object|null}
     */
    trailer() {}
    /**
     * @returns {object|null}
     */
    next() {}
}

/**
 * loads a parser function
 * @param {string} m module name
 * @param {string} p parser name
 * @returns {ParserFunction}
 */
function getParserFunction(m, p) {
    return new Promise((res, rej) => {
        if (m in modcache) {
            return res(modcache[m][p]);
        }
        import(`/helpers/comparse/${m}.js`).then(mod => {modcache[m] = mod;res(mod[p]);}).catch(e => rej(e));
    });
}
