
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
        // console.log(`CONSUMING ${count} BYTES`);
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if ((count ?? 1) <= 1) {
            // console.log(this._bytes[this._pos]);
            return this._bytes[this._pos++];
        }
        const s = this._bytes.slice(this._pos, this._pos+count);
        this._pos += count;
        // console.log(s);
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
            // console.log(this._bytes[this._pos]);
            // console.log(this._pos);
            // console.log(this._bytes);
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
 * @prop {boolean?} EXTMETA
 * @prop {boolean?} EXTEVS
 * @prop {number[]} extra_flags
 * @prop {Record<number,number[]>} metatable
 * @prop {Record<number,{name:string,condflag:boolean,size:number,flag_byte:number?,flag_bit:number?}[]>?} extev_descriptors
 */
/**
 * @typedef {number[][]|Record<string,number[]|null>} _ExtFieldValues
 * @typedef ReplayEvent
 * @type {{type:0,time_delta:number,player:number,ext:_ExtFieldValues}|{type:1,time_delta:number,player:number,tile:number,ext:_ExtFieldValues}|{type:2,time_delta:number}|{type:number,time_delta?:number,ext:_ExtFieldValues}}
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
        // console.log(version);
        // console.log(PARSERS[version]);
        /**@type {AParser} */
        this.parser = new PARSERS[version](this.raw_data);
    }
    /**
     * @returns {number}
     */
    tell() {
        return this.raw_data._pos;
    }
    /**
     * @param {number} pos
     */
    seek(pos) {
        this.raw_data._pos = pos;
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
    /**
     * @param {string} key
     * @returns {Uint8Array}
     */
    getMetatableEntry(key) {}
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
    // if (_) return acc;
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
        this.header.ORDER = ((flags>>4)&1) !== 0;
        this.header.CTOPOLOGY = ((flags>>3)&1) !== 0;
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

class Version5 {
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
        this.header.ORDER = ((flags>>4)&1) !== 0;
        this.header.CTOPOLOGY = ((flags>>3)&1) !== 0;
        this.header.EXTMETA = ((flags>>2)&1) !== 0;
        this.header.EXTEVS = (flags&2) !== 0
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
        if (this.header.EXTMETA) {
            const efc = data.consume();
            if (efc) {
                this.header.extra_flags = data.consume(efc);
                if (typeof this.header.extra_flags === "number") {
                    this.header.extra_flags = [this.header.extra_flags];
                } else {
                    this.header.extra_flags = [...this.header.extra_flags];
                }
            }
            const emc = fromBytes(data.consume(2));
            this.header.metatable = {};
            for (let i = 0; i < emc; i ++) {
                const l = fromBytes(data.consume(2));
                if (l === 0) {
                    this.header.metatable[String.fromCharCode(...data.consume(4))] = [];
                    continue;
                }
                this.header.metatable[String.fromCharCode(...data.consume(4))] = l===1?[data.consume()]:[...data.consume(l)];
            }
        }
        if (this.header.EXTEVS) {
            this.header.extev_descriptors = {};
            const eec = data.consume();
            for (let i = 0; i < eec; i ++) {
                const id = data.consume();
                const fc = data.consume();
                this.header.extev_descriptors[id] = [];
                for (let j = 0; j < fc; j ++) {
                    const b1 = data.consume();
                    const f = {name:""};
                    if (b1 & 0x80) {
                        f.flag_byte = b1 & 0x7f;
                        f.condflag = true;
                        const b2 = data.consume();
                        f.flag_bit = b2 >> 5;
                        f.size = b2 & 0x1f;
                    } else {
                        f.condflag = false;
                        f.size = b1 & 0x7f;
                    }
                    this.header.extev_descriptors[id].push(f);
                }
            }
        }
        console.log(this.header.extev_descriptors)
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
        if (this.header.EXTEVS && ev.type in this.header.extev_descriptors) {
            ev.ext = [];
            this.header.extev_descriptors[ev.type].forEach(fd => {
                if (fd.condflag) {
                    // console.log(fd.flag_bit);
                    // console.log(fd.flag_byte);
                    // console.log(this.header.extra_flags);
                    // console.log(this.header.extra_flags[fd.flag_byte]>>fd.flag_bit);
                    if (((this.header.extra_flags[fd.flag_byte]>>fd.flag_bit) & 1) === 0) {
                        return;
                    }
                }
                ev.ext.push(fd.size===1?[this.data.consume()]:[...this.data.consume(fd.size)]);
            });
        }
        return ev;
    }
}

class Version6 {
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
        this.header.ORDER = ((flags>>4)&1) !== 0;
        this.header.CTOPOLOGY = ((flags>>3)&1) !== 0;
        this.header.EXTMETA = ((flags>>2)&1) !== 0;
        this.header.EXTEVS = (flags&2) !== 0
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
        // console.log(this.header);
        // console.log(data._bytes.slice(data._pos));
        if (this.header.EXTMETA) {
            const efc = data.consume();
            if (efc) {
                this.header.extra_flags = data.consume(efc);
                if (typeof this.header.extra_flags === "number") {
                    this.header.extra_flags = [this.header.extra_flags];
                } else {
                    this.header.extra_flags = [...this.header.extra_flags];
                }
            }
            const emc = fromBytes(data.consume(2));
            this.header.metatable = {};
            for (let i = 0; i < emc; i ++) {
                const l = fromBytes(data.consume(2));
                if (l === 0) {
                    this.header.metatable[String.fromCharCode(...data.consume(4))] = [];
                    continue;
                }
                this.header.metatable[String.fromCharCode(...data.consume(4))] = l===1?[data.consume()]:[...data.consume(l)];
            }
        }
        if (this.header.EXTEVS) {
            this.header.extev_descriptors = {};
            const eec = data.consume();
            // console.log(eec);
            for (let i = 0; i < eec; i ++) {
                const id = data.consume();
                const fc = data.consume();
                // console.log(`${id}, ${fc}`);
                this.header.extev_descriptors[id] = [];
                for (let j = 0; j < fc; j ++) {
                    const f = {name:String.fromCharCode(...data.consume(data.consume()))};
                    const b1 = data.consume();
                    // console.log(b1);
                    if (b1 & 0x80) {
                        f.condflag = true;
                        if (b1 & 0x40) {
                            f.offset = ((b1>>3)&7) + 1;
                            f.check = b1&7;
                            // console.log(`${f.offset}, ${f.check}:`);
                            f.test = fromBytes(data.consume(this.header.extev_descriptors[id][this.header.extev_descriptors[id].length-f.offset].size));
                            f.size = data.consume();
                        } else {
                            f.flag_byte = b1 & 0x7f;
                            const b2 = data.consume();
                            f.flag_bit = b2 >> 5;
                            f.size = b2 & 0x1f;
                        }
                    } else {
                        f.condflag = false;
                        f.size = b1 & 0x7f;
                    }
                    this.header.extev_descriptors[id].push(f);
                }
            }
        }
        // console.log(this.header.extev_descriptors)
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
        if (ev.type < 2 && this.header.TIMESTAMP) {
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
        if (this.header.EXTEVS && ev.type in this.header.extev_descriptors) {
            ev.ext = {};
            this.header.extev_descriptors[ev.type].forEach((fd,i,a) => {
                fd.present = false;
                if (fd.condflag) {
                    // console.log(fd.flag_bit);
                    // console.log(fd.flag_byte);
                    // console.log(this.header.extra_flags);
                    // console.log(this.header.extra_flags[fd.flag_byte]>>fd.flag_bit);
                    if (fd.offset !== undefined) {
                        if (!a[i-fd.offset].present) return;
                        const value = fromBytes(ev.ext[a[i-fd.offset].name]);
                        switch (fd.check) {
                            case 0:if(value!==fd.test)return;break;
                            case 1:if(value===fd.test)return;break;
                            case 2:if(value<=fd.test)return;break;
                            case 3:if(value>=fd.test)return;break;
                            case 4:if(value<fd.test)return;break;
                            case 5:if(value>fd.test)return;break;
                            case 6:if(value%fd.test!==0)return;break;
                            case 6:if(value%fd.test===0)return;break;
                        }
                    } else if (((this.header.extra_flags[fd.flag_byte]>>fd.flag_bit) & 1) === 0) {
                        return;
                    }
                }
                fd.present = true;
                if (fd.size === 0) {
                    ev.ext[fd.name] = null;
                } else {
                    ev.ext[fd.name] = fd.size===1?[this.data.consume()]:[...this.data.consume(fd.size)];
                }
            });
        }
        return ev;
    }
    getMetatableEntry(key) {
        return getMetatableEntry(this.header.metatable, key);
    }
}

const PARSERS = {4:Version4,5:Version5,6:Version6};


/**
 * @typedef STPLPlayer
 * @type {{isbot:true,botq:string,accid:string|null}|{isbot:false,accid:string|null}}
 * @typedef STPLPlayers
 * @type {Array<null|STPLPlayer>}
 * @typedef STPLTurnTime
 * @type {null|(({style:"per turn",penalty:"random"|"skip"|"lose"}|{style:"chess",penalty:"lose"})&{limit:number})}
 * @typedef {null|{style:"elim"|"tile"|"piece",score:number[]}} STPLScoring
 * @typedef STPLRules
 * @type {{turnTime:STPLTurnTime,scoring:STPLScoring}}
 */


export class STPLParser {
    static _STYLES = ["per turn", "chess"];
    static _PENALTIES = ["random", "skip", "lose"];
    static _SCORING = ["elim", "tile", "piece"];
    /**
     * @param {AParser} parser
     */
    constructor(parser) {
        /**@type {STPLPlayers} */
        this.players = [];
        /**@type {STPLRules} */
        this.rules = {};
        const rawpd = new ConsumableBytes(getMetatableEntry(parser.header.metatable, "pn__"));
        for (let i = 0; i < parser.header.player_count+1; i ++) {
            const b = rawpd.consume();
            if (b === 0) {
                this.players.push(null);
            } else {
                const v = {};
                if (b === 1) {
                    v.isbot = false;
                } else if (b === 2) {
                    v.isbot = true;
                    v.botq = String.fromCharCode(...rawpd.consume(rawpd.consume()));
                }
                const al = rawpd.consume();
                if (al === 0) {
                    v.accid = null;
                } else {
                    v.accid = String.fromCharCode(...rawpd.consume(al));
                }
                this.players.push(v);
            }
        }
        const rawtt = new ConsumableBytes(getMetatableEntry(parser.header.metatable, "rlz_"));
        if (rawtt.consume()) {
            this.rules.turnTime = {};
            this.rules.turnTime.penalty = STPLParser._PENALTIES[rawtt.consume()];
            this.rules.turnTime.style = STPLParser._STYLES[rawtt.consume()];
            switch (this.rules.turnTime.style) {
                case "per turn": {
                    this.rules.turnTime.limit = fromBytes(rawtt.consume(4)) * 1000;
                    break;
                }
                case "chess": {
                    this.rules.turnTime.limit = fromBytes(rawtt.consume(4)) * 1000;
                    for (let i = 0; i < parser.header.player_count; i ++) {
                        const timel = fromBytes(rawtt.consume(4));
                        if (this.players[i]) {
                            this.players[i].time_left = timel;
                        }
                    }
                    break;
                }
            }
        } else {
            this.rules.turnTime = {style:"per turn",limit:null,penalty:"skip"};
        }
        if (rawtt._pos < rawtt._bytes.length) {
            if (rawtt.consume()) {
                this.rules.scoring = {style:STPLParser._SCORING[rawtt.consume()]};
                this.rules.scoring.score = [];
                for (let i = 0, l = rawtt.consume(); i < l; i ++) {
                    const v = fromBytes(rawtt.consume(6));
                    this.rules.scoring.score.push((this.rules.scoring.style==="elim"&&v===0)?null:v);
                }
            }
        }
    }
}

/**
 * @param {Record<number,Uint8Array>} table
 * @param {string} key
 * @param {Uint8Array} value
 * @returns {void}
 */
function setMetatableEntry(table, key, value) {
    const globi = key.indexOf("_");
    if (globi !== -1) {
        let c = 0;
        const s = key.slice(0, globi);
        // console.log(`globi: ${globi}, s: ${s}`);
        for (let i = 0, l = value.length; i < l; i += 0xffff) {
            const k = s+(c.toString(36).padStart(4-globi,'0'));
            // console.log(`key: ${k}`);
            setMetatableEntry(table, k, value.subarray(i, Math.min(i+0xffff,l)));
        }
        return;
    }
    let k = key.charCodeAt(0)<<24;
    // console.log(k);
    k |= key.charCodeAt(1)<<16;
    // console.log(k);
    k |= key.charCodeAt(2)<<8;
    // console.log(k);
    k |= key.charCodeAt(3);
    // console.log(k);
    table[k] = value;
}
/**
 * @param {Record<number,Uint8Array>} table
 * @param {string} key
 * @returns {Uint8Array}
 */
function getMetatableEntry(table, key) {
    const globi = key.indexOf("_");
    if (globi !== -1) {
        let c = 0;
        const bufs = [];
        const s = key.slice(0, globi);
        // console.log(`globi: ${globi}, s: ${s}`);
        for (; c < 36; c ++) {
            const v = getMetatableEntry(table, s+(c.toString(36).padStart(4-globi,'0')));
            if (!v) {
                break;
            }
            bufs.push(v);
        }
        return Uint8Array.from(bufs.map(v=>[...v]).flat());
    }
    // let k = key.charCodeAt(0)<<24;
    // // console.log(k);
    // k |= key.charCodeAt(1)<<16;
    // // console.log(k);
    // k |= key.charCodeAt(2)<<8;
    // // console.log(k);
    // k |= key.charCodeAt(3);
    // // console.log(k);
    // return table[k];
    return table[key];
}
