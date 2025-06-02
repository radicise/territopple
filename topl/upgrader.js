/**
 * @file
 * contains functionality to upgrade replay files to newer format versions
 */

export class ConsumableBytes {
    /**
     * @param {Uint8Array} bytes
     */
    constructor(bytes) {
        this._bytes = bytes;
        this._pos = 0;
    }
    /**
     * consumes count bytes
     * @overload
     * @param {number} count
     * @returns {Uint8Array}
     * 
     * @overload
     * @param {1} count
     * @returns {number}
     * 
     * @param {1|number}
     * @returns {number|Uint8Array}
     */
    consume(count) {
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if (count === 1) {
            return this._bytes[this._pos++];
        }
        const s = this._bytes.slice(this._pos, this._pos+count);
        this._pos += count;
        return s;
    }
    /**
     * peeks ahead by, and does not consume, count bytes
     * @overload
     * @param {number} count
     * @returns {Uint8Array}
     * 
     * @overload
     * @param {1} count
     * @returns {number}
     * 
     * @param {1|number} count
     * @returns {Uint8Array|number}
     */
    peek(count) {
        if (count === 1) {
            return this._bytes[this._pos];
        }
        return this._bytes.slice(this._pos, this._pos+count);
    }
}

/**
 * upgrades a single replay by a single version
 * @param {Uint8Array} _data
 * @returns {Uint8Array}
 */
export function upgrade_single(_data) {
    const ret = [];
    const data = new ConsumableBytes(_data);
    const version = data.consume(1);
    switch (version) {
        case 0:{
            throw new FormatError("version zero is not supported for automatic upgrading");
        }
        case 1:{
            ret.push(2);
            ret.push(...data.consume(8));
            const flags = data.consume(1);
            ret.push(flags);
            ret.push(...data.consume(8));
            ret.push(...data.consume(5));
            const timestamp = (flags & 128) > 0;
            const size = (flags >> 5) & 3;
            while (true) {
                ret.push(...data.consume(2));
                if (data._bytes[data._pos-2] === 0xf0 && data._bytes[data._pos-1] === 0x0f) {
                    break;
                }
            }
            while (true) {
                if (cmpLists(data.peek(4), [0xff, 0xf0, 0x0f, 0xff])) {
                    ret.push(...data.consume(4));
                    break;
                }
                const type = data.consume(1);
                ret.push(type);
                switch (type) {
                    case 0:{
                        if (timestamp) {
                            ret.push(...data.consume(2));
                        }
                        ret.push(data.consume(1));
                        break;
                    }
                    case 1:{
                        if (timestamp) {
                            ret.push(...data.consume(2));
                        }
                        ret.push(...data.consume([2,2,3,4][size]));
                        break;
                    }
                    case 2:{
                        if (!timestamp) throw new FormatError("timestamp event not permitted when timestamp flag not set");
                        ret.push(...data.consume(3));
                        break;
                    }
                }
            }
            break;
        }
    }
    return Uint8Array.from(ret);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function cmpLists(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

class FormatError extends Error {
    /**
     * @param {String} message
     */
    constructor (message) {
        super(message);
        this.name = "FormatError";
    }
}
