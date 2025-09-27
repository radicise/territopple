
export class ConsumableBytes {
    /**
     * @param {Uint8Array} bytes
     */
    constructor(bytes) {
        this._bytes = bytes;
        this._pos = 0;
    }
    // /**
    //  * consumes count bytes
    //  * @param {number} count
    //  * @returns {Uint8Array|number}
    //  */
    /**
     * consumes count bytes
     * @type {{
     * (): number;
     * (count: number): Uint8Array;
     * }}
     */
    consume = (count) => {
        console.log(`CONSUMING ${count} BYTES`);
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if ((count ?? 1) <= 1) {
            console.log(this._bytes[this._pos]);
            return this._bytes[this._pos++];
        }
        const s = this._bytes.slice(this._pos, this._pos+count);
        this._pos += count;
        console.log(s);
        return s;
    }
    // /**
    //  * peeks ahead by, and does not consume, one byte
    //  * @param {1} count
    //  * @returns {number}
    //  *//**
    //   * peeks ahead by, and does not consume, count bytes
    //   * @param {number} count
    //   * @returns {Uint8Array}
    //   */
    /**
     * peeks ahead by, and does not consume, count bytes
     * @type {{
     * (count: 1): number;
     * (count: number): Uint8Array;
     * }}
     */
    peek = (count) => {
        if (count === 1) {
            return this._bytes[this._pos];
        }
        return this._bytes.slice(this._pos, this._pos+count);
    }
}

/**
 * @typedef ReplayHeader
 * @type {object}
 * @prop {number} version
 * @prop {string} name
 * @prop {boolean} TIMESTAMP
 * @prop {number} SIZE
 * @prop {boolean} ORDER
 * @prop {boolean} CTOPOLOGY
 * @prop {bigint} start_time
 * @prop {number} tile_count
 * @prop {number} player_count
 * @prop {number} order_strategy
 * @prop {number[]} team_table
 * @prop {{params:number[]}} topology_data
 * @prop {number} topology_id
 * @prop {bigint} game_sid
 * @prop {string} server_id
 */
/**
 * @typedef ReplayEvent
 * @type {{type:0,time_delta:number,player:number}|{type:1,time_delta:number,player:number,tile:number}|{type:2,time_delta:number}}
 */

/**
 * handles parsing of replay files
 */
export class ReplayParser {
    /**
     * @param {Uint8Array} replay_data
     * @throws {Error} thrown on invalid data
     */
    constructor(replay_data) {
        /**@type {ConsumableBytes} */
        this.raw_data = new ConsumableBytes(replay_data);
        /**@type {number} */
        const version = this.raw_data.peek(1);
        if (!version in PARSERS) {
            throw new Error("invalid version");
        }
        /**@type {AParser} */
        this.parser = new PARSERS[version](this.raw_data);
    }
    /**
     * @returns {ReplayHeader}
     */
    get header() {
        return this.parser.header;
    }
    /**
     * @returns {ReplayEvent}
     */
    nextEvent() {
        return this.parser.nextEvent();
    }
}

class AParser {
    /**
     * @param {ConsumableBytes} data
     */
    constructor(data) {}
    /**
     * @returns {ReplayHeader}
     */
    get header() {}
    /**
     * @returns {ReplayEvent}
     */
    nextEvent() {}
}

/**
 * @param {number[]} b
 * @returns {number}
 */
function fromBytes(b, _) {
    let acc = 0n;
    // b.reverse();
    // for (let i = 0; i < b.length; i ++) {
    //     acc |= ((b[i])<<(i*8));
    // }
    for (let i = b.length-1; i >= 0; i --) {
        acc |= BigInt(b[i])<<BigInt(8*(b.length-i-1));
    }
    if (_) return acc;
    return Number(acc);
}
/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function cmpLists(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
/**
 * @param {Date} t current time
 * @param {number} [d=0] ms since previous time
 * @returns {string}
 */
export function formatTime(t, d) {
    d = d || 0;
    const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
    const days = Math.floor(d/D);
    const hours = Math.floor((d%D)/H).toLocaleString("en-US", {minimumIntegerDigits:2});
    const minutes = Math.floor((d%H)/M).toLocaleString("en-US", {minimumIntegerDigits:2});
    const seconds = Math.floor((d%M)/S).toLocaleString("en-US", {minimumIntegerDigits:2});
    const millis = Math.floor(d%S).toLocaleString("en-US", {minimumIntegerDigits:4, useGrouping:false});
    return `${t} (+${days}:${hours}:${minutes}:${seconds}.${millis})`;
}

class Version4 {
    /**
     * @param {ConsumableBytes} data
     */
    constructor(data) {
        /**@type {ConsumableBytes} */
        this.data = data;
        /**@type {ReplayHeader} */
        this.header = {};
        this.header.version = this.data.consume();
        this.header.name = [...this.data.consume(8)].map(v => String.fromCharCode(v)).join('');
        /**@type {number} */
        const flags = this.data.consume();
        this.header.TIMESTAMP = (flags>>7) !== 0;
        this.header.SIZE = (flags>>5)&3;
        this.header.ORDER = (flags>>4) !== 0;
        this.header.CTOPOLOGY = (flags>>3) !== 0;
        this.header.start_time = fromBytes(data.consume(8), true);
        this.header.tile_count = fromBytes(data.consume(4));
        this.header.player_count = data.consume();
        if (this.header.ORDER) {
            this.header.order_strategy = data.consume();
            if (this.header.order_strategy !== 0) {
                throw new Error("standard order not supported yet");
            }
            // data.consume();
            this.header.team_table = [];
            for (let i = 0; i < this.header.player_count; i ++) {
                this.header.team_table.push(data.consume());
            }
            // if (this.header.player_count%2 !== 0) {
            //     data.consume();
            // }
        }
        this.header.topology_data = {params:[]};
        if (this.header.CTOPOLOGY) {
            throw new Error("CTOPOLOGY not supported yet");
        } else {
            this.header.topology_id = fromBytes(data.consume(2));
            if (this.header.topology_id < 4) {
                this.header.topology_data.params[0] = fromBytes(data.consume(2));
                this.header.topology_data.params[1] = this.header.tile_count/this.header.topology_data.params[0];
            } else {
                throw new Error("invalid topology id");
            }
        }
        this.header.game_sid = fromBytes(data.consume(8), true);
        this.header.server_id = [...data.consume(16)].map((v,i) => v.toString(16).padStart(2,"0")+((i+1)%4===0)?"-":"").join("");
        let c = 0;
        while (true) { // find start of events
            if (c++ >= 4) {
                console.log(data._bytes);
                console.log(this.header);
                throw new Error("RUNAWAY LOOP");
            }
            if (cmpLists(data.consume(2), [0xf0,0x0f])) {
                break;
            }
        }
    }
    /**
     * @returns {ReplayEvent}
     */
    nextEvent() {
        if (cmpLists(this.data.peek(4), [0xff,0xf0,0x0f,0xff])) {
            return null;
        }
        /**@type {ReplayEvent} */
        const ev = {};
        ev.type = this.data.consume();
        if (ev.type !== 2 && this.header.TIMESTAMP) {
            ev.time_delta = fromBytes(this.data.consume(2));
        }
        switch (ev.type) {
            case 0: {
                ev.player = this.data.consume();
                break;
            }
            case 1: {
                inner: switch (this.header.SIZE) {
                    case 0: {
                        const b = this.data.consume();
                        ev.player = b >> 5;
                        ev.tile = b & 0x1f;
                        break inner;
                    }
                    case 1: {
                        const b = fromBytes(this.data.consume(2));
                        ev.player = b >> 10;
                        ev.tile = b & 0x3ff;
                        break inner;
                    }
                    case 2: {
                        ev.player = this.data.consume();
                        ev.tile = fromBytes(this.data.consume(2));
                        break inner;
                    }
                    case 3: {
                        const b = fromBytes(this.data.consume(4));
                        ev.player = b >> 20;
                        ev.tile = b & 0xfffff;
                        break inner;
                    }
                }
                break;
            }
            case 2: {
                ev.time_delta = fromBytes(this.data.consume(3));
                break;
            }
        }
        return ev;
    }
}

const PARSERS = {4:Version4};
