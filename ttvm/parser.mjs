/**
 * @file
 * parser for TTVM code
 */

export class ConsumableBuffer {
    /**
     * @param {Buffer} bytes
     */
    constructor(bytes) {
        this._bytes = bytes;
        this._pos = 0;
    }
    /**
     * consumes size bytes and returns the result of interpreting them as a UInt[size]BE
     * @param {number} size
     * @returns {number}
     */
    readUIntBE(size) {
        this._pos += size;
        return this._bytes.subarray(this._pos-size,this._pos)[["readUint8","readUint16BE","readUint32BE"][size>>1]]();
    }
    /**
     * @param {number} size
     * @returns {string}
     */
    readZSTR(size) {
        return this.consume(this.readUIntBE(size),true).toString("ascii");
    }
    /**
     * @param {number} to
     * @param {0|1|2} ref curr, start, end
     */
    seek(to, ref) {
        if (ref === 2) {
            this._pos = this._bytes.length - to;
        } else if (ref === 1) {
            this._pos = to;
        } else {
            this._pos += to;
        }
    }
    /**
     * tells the current position
     * @returns {number}
     */
    tell() {return this._pos;}
    /**
     * consumes count bytes
     * @type {{
     * (): number;
     * (count: number): Buffer;
     * }}
     */
    consume = (count, _) => {
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if (_) {
            const s = this._bytes.subarray(this._pos, this._pos + (count ?? 1));
            this._pos += count ?? 1;
            return s;
        }
        if ((count ?? 1) <= 1) {
            return this._bytes[this._pos++];
        }
        const s = this._bytes.subarray(this._pos, this._pos+count);
        this._pos += count;
        return s;
    }
    /**
     * peeks ahead by, and does not consume, count bytes
     * @type {{
     * (count: 1): number;
     * (count: number): Buffer;
     * }}
     */
    peek = (count) => {
        if (count === 1) {
            return this._bytes[this._pos];
        }
        return this._bytes.subarray(this._pos, this._pos+count);
    }
}

/**
 * @enum {number}
 */
export const SECTABLE = {
    CONF: 0,
    CODE: 1,
    DATA: 2,
    INDX: 3
};

/**
 * @enum {number}
 */
export const PURPOSE = {
    /**
     * @description
     * TerriTopple Topology Rules
     */
    T3R: 0,
    /**
     * @description
     * General Purpose Code
     */
    GPC: 1,
    /**
     * @description
     * Bot code
     */
    BOT: 2,
    /**
     * @description
     * Scenario Behaviors Code
     */
    SBC: 3,
};

/**
 * @enum {number}
 */
export const DATATYPE = {
    S32BE: 0,
    STRING: 1,
    F64BE: 2,
    UNINIT: 3
};

/**
 * @enum {number}
 */
export const VMTYPE = {
    VOID: 0x00,
    PTR: 0x0100,
    IPTR: 0x01ff,
    SSTR: 0x02,
    LSTR: 0x03,
    S8: 0xb1,
    S16: 0xb2,
    S32: 0xb4,
    S64: 0xb8,
    S128: 0xc0,
    U8: 0x81,
    U16: 0x82,
    U32: 0x84,
    U64: 0x88,
    U128: 0x90,
    F32: 0xe4,
    F64: 0xe8,
    SIZEDARR: 0x4000,
    UNSIZEDARR: 0x0400,
    OPAQUESTRUCT: 0x05,
    TRANSPARENTSTRUCT: 0x06,
};

/**
 * inverse map for VMTYPE values to names
 * @type {Record<number,string>}
 */
export const VMTYPE_NAME = {};
Object.entries(VMTYPE).forEach(v => VMTYPE_NAME[v[1]]=v[0]);

const SEC_COUNT = Object.keys(SECTABLE).length;

/**
 * @typedef SECDATA
 * @type {{length:number}}
 */

/**
 * @description
 * parses TTVM code
 * section data is parsed lazily
 */
export class TTVMParser {
    #data;
    /**
     * @private
     * @param {ConsumableBuffer} data
     * @param {number[]} table
     * @param {number} version
     */
    constructor(data,table,version) {
        /**@private */
        this.#data = data;
        /**
         * @private
         * @description
         * u32BE - SECSTART
         * u32BE - SECLEN
         * (SECSTART,SECLEN)+
         */
        this._sectable = table;
        /**
         * @readonly
         */
        this.version = version;
        /**
         * @private
         */
        this._conf = {
            /**
             * @type {PURPOSE}
             * @readonly
             */
            purpose: null,
            /**
             * @type {string}
             * @readonly
             */
            name: null,
            /**
             * @type {number}
             * @readonly
             */
            invar_count: null,
            /**
             * @type {number}
             * @readonly
             */
            RR_SOME: null,
            /**
             * @type {number}
             * @readonly
             */
            RR_NONE: null,
        };
        /**
         * @private
         */
        this._data = {
            /**
             * @type {string}
             * @readonly
             */
            fmtstr: null,
            /**
             * @type {Array<{type:0|2|3,value:number}|{type:1,value:string}>}
             * @readonly
             */
            datavars: null,
        };
        /**
         * @private
         */
        this._code = {
            /**
             * @type {Record<string,{name:string,params:Record<string,VMTYPE>,codelen:number,rtype:VMTYPE}>}
             * @readonly
             */
            symbols: null,
        };
        /**
         * @private
         */
        this._indx = {
            /**
             * @type {Array<{symbol:string,offset:number}>}
             * @readonly
             */
            entries: null,
        };
    }
    get conf() {
        if (this._conf.purpose === null) {
            this.#data.seek(this._sectable[SECTABLE.CONF<<1], 1);
            this.#data.seek(16);
            this._conf.purpose = this.#data.consume();
            this._conf.name = this.#data.readZSTR(1);
            this._conf.invar_count = this.#data.consume();
            this._conf.RR_SOME = this.#data.readUIntBE(2);
            this._conf.RR_NONE = this.#data.readUIntBE(2);
            this._conf = Object.freeze(this._conf);
        }
        return this._conf;
    }
    get data() {
        if (this._data.fmtstr === null) {
            this.#data.seek(this._sectable[SECTABLE.DATA<<1], 1);
            this.#data.seek(16);
            this._data.fmtstr = this.#data.readZSTR(2);
            this._data.datavars = new Array(this.#data.readUIntBE(2)).fill(null);
            for (let i = 0; i < this._data.datavars.length; i ++) {
                const t = this.#data.consume();
                this._data.datavars[i] = {type:t, value:(t===0?this.#data.consume(4).readInt32BE():(t===1?this.#data.readZSTR(1):(t===2?this.#data.consume(8).readDoubleBE():this.#data.consume(2).readUint16BE())))};
            }
            this._data = Object.freeze(this._data);
        }
        return this._data;
    }
    get code() {
        if (this._code.symbols === null) {
            this._code.symbols = {};
            this.#data.seek(this._sectable[SECTABLE.CODE<<1], 1);
            this.#data.seek(16);
            const end = this.#data.tell() + this._sectable[(SECTABLE.CODE<<1)+1];
            // console.log(end);
            // console.log(this.#data._bytes.subarray(end, end+10).toString("ascii"));
            while (this.#data.tell() < end) {
                const sym = {name:this.#data.readZSTR(1),params:{}};
                // console.log(sym);
                switch (sym.name) {
                    case "@getpositionof": {
                        sym.params["tindex"] = VMTYPE.U32;
                        sym.params["mode"] = VMTYPE.U16;
                        sym.rtype = VMTYPE.UNSIZEDARR|VMTYPE.U16;
                        break;
                    }
                    case "@getneighbors": {
                        sym.params["tindex"] = VMTYPE.U32;
                        sym.rtype = VMTYPE.UNSIZEDARR|VMTYPE.U32;
                        break;
                    }
                    case "@getrequiredbits": {
                        sym.params["tindex"] = VMTYPE.U32;
                        sym.rtype = VMTYPE.U8;
                        break;
                    }
                    case "@think": {
                        sym.params["state"] = VMTYPE.PTR|VMTYPE.OPAQUESTRUCT;
                        sym.rtype = VMTYPE.U32;
                        break;
                    }
                    default: {
                        const pl = [];
                        for (let i = 0, l = this.#data.consume(); i < l; i ++) {
                            const p = this.#data.readZSTR(1);
                            pl.push(p);
                            sym.params[p] = null;
                        }
                        // console.log(sym);
                        if (sym.name === "@constructor") {
                            for (const param in sym.params) {
                                sym.params[param] = VMTYPE.U32;
                            }
                            sym.rtype = VMTYPE.VOID;
                        } else {
                            for (const p of pl) {
                                let t = this.#data.consume();
                                if ([VMTYPE.PTR,VMTYPE.UNSIZEDARR].some(v => (t<<8)===v) || (t<<8) & VMTYPE.SIZEDARR === VMTYPE.SIZEDARR) {
                                    t |= this.#data.consume();
                                }
                                sym.params[p] = t;
                            }
                            let t = this.#data.consume();
                            if (t&0xff === 0 && t !== 0) {
                                t |= this.#data.consume();
                            }
                            sym.rtype = t;
                        }
                        // console.log(sym);
                        break;
                    }
                }
                sym.codelen = this.#data.readUIntBE(4);
                this.#data.seek(sym.codelen);
                this._code.symbols[sym.name] = Object.freeze(sym);
                // console.log(this.#data.tell());
                // console.log(this.#data._bytes.subarray(this.#data.tell(), this.#data.tell()+10));
            }
            this._code.symbols = Object.freeze(this._code.symbols);
            this._code = Object.freeze(this._code);
        }
        return this._code;
    }
    get indx() {
        if (this._indx.entries === null) {
            this.#data.seek(this._sectable[SECTABLE.INDX<<1], 1);
            this.#data.seek(16);
            this._indx.entries = new Array(this.#data.readUIntBE(2));
            for (let i = 0; i < this._indx.entries.length; i ++) {
                this._indx.entries[i] = Object.freeze({symbol:this.#data.readZSTR(1),offset:this.#data.readUIntBE(4)});
            }
            this._indx.entries = Object.freeze(this._indx.entries);
            this._indx = Object.freeze(this._indx);
        }
        return this._indx;
    }
    /**
     * @returns {Buffer}
     */
    copyCode() {
        return this.#data._bytes.subarray(this._sectable[SECTABLE.CODE<<1]+16, this._sectable[SECTABLE.CODE<<1]+this._sectable[(SECTABLE.CODE<<1)+1]);
    }
    /**
     * @param {SECTABLE} sec
     * @returns {number}
     */
    lengthOf(sec) {
        return this._sectable[(sec<<1)+1];
    }
    /**
     * creates a new parser and loads the given TTVM code
     * @param {Buffer} rawdata
     * @returns {TTVMParser}
     */
    static load(rawdata) {
        const sec_table = new Array(SEC_COUNT*2).fill(0);
        const data = new ConsumableBuffer(rawdata);
        const version = data.consume();
        if (version !== 1) {
            throw new Error("unsupported format version");
        }
        for (let i = 0, s = SEC_COUNT; i < s; i ++) {
            const _pos = data.tell();
            if (data.consume(7).toString("ascii") !== "SECTION") {
                throw new Error("invalid SECTION definition (no SECTION)");
            }
            const secname = data.consume(5).toString("ascii");
            const tblname = secname.slice(1).toUpperCase();
            if (secname[0] !== '.' || !(tblname in SECTABLE)) {
                throw new Error("invalid SECTION definition (bad NAME)");
            }
            sec_table[SECTABLE[tblname]*2] = _pos;
            const l = data.readUIntBE(4);
            sec_table[SECTABLE[tblname]*2+1] = l;
            data.seek(l);
        }
        return new TTVMParser(data, sec_table, version);
    }
}
