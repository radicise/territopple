import * as topology_ from "../../topology/topology.js";

/**@type {typeof import("../../topology/topology.js")} */
export const topology = topology_;

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
            return this._bytes[this._pos];
        }
        return this._bytes.slice(this._pos, this._pos+count);
    }
}

/**
 * @param {ConsumableBytes} bytes
 * @param {number} N
 * @returns {number}
 */
export function readNByteNum(bytes, N) {
    if (N === 1) {return bytes.consume(1);}
    const l = bytes.consume(N);
    return Number([...l].map((v, i) => BigInt(v)<<BigInt((N-i-1)*8)).reduce(((pv, cv) => pv | cv), 0n));
}

/**
 * @param {ConsumableBytes} bytes
 * @param {number} N
 * @returns {string}
 */
export function consumeNStr(bytes, N) {
    const L = readNByteNum(bytes, N);
    if (L === 0) return "";
    if (L === 1) {
        return String.fromCharCode(bytes.consume(1));
    }
    return [...bytes.consume(L)].map(v => String.fromCharCode(v)).join('');
}

/**
 * @param {Uint8Array} arr
 * @returns {(n:number)=>number}
 */
export function standaloneBitConsumer(arr) {
    let bypos = 0;
    let bipos = 0;
    const consumebits = (n) => {
        if (n === -1) {return [bypos, bipos];}
        if (bipos === 8) {
            bypos ++;
            bipos = 0;
        }
        if (bipos + n > 8) {
            const rem = 8 - bipos;
            const oth = n - rem;
            return (consumebits(rem)<<oth)|consumebits(oth);
        }
        // const r = (arr[bypos]>>(7-bipos))&(0xff>>(8-n));
        // const r = (arr[bypos]>>(0xff>>bipos))&(0xff>>(8-n));
        const r = (arr[bypos]>>(8-bipos-n))&(0xff>>(8-n));
        bipos += n;
        return r;
    };
    return consumebits;
}
