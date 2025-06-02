/**
 * @file
 * this file handles the running of the TerriTopple Topology VM
 */

import { flags2TilePosition } from "../rendertypes.js";

const CMPFLAGS = {
    EQ:1,
    LESS:2,
    MORE:4,
    LESSEQ:3,
    MOREEQ:5
};

/**
 * @typedef {{mem:any[],regs:any[],flagreg:number}} VMTarget
 */

class ConsumableBuffer {
    /**
     * @param {Buffer} bytes
     */
    constructor(bytes) {
        this._bytes = bytes;
        this._pos = 0;
    }
    /**
     * consumes count bytes
     * @param {number} count
     * @returns {Buffer|number}
     */
    consume(count) {
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if (count === 0) {
            return Buffer.of();
        }
        if (count === 1) {
            return this._bytes[this._pos++];
        }
        const s = this._bytes.subarray(this._pos, this._pos+count);
        this._pos += count;
        return s;
    }
    /**
     * peeks ahead by, and does not consume, count bytes
     * @param {number} count
     * @returns {Buffer|number}
     */
    peek(count) {
        if (count === 1) {
            return this._bytes[this._pos];
        }
        return this._bytes.subarray(this._pos, this._pos+count);
    }
}

/**
 * reads a short string from a consumable buffer
 * @param {ConsumableBuffer} buf
 * @returns {string}
 */
function readSStr(buf) {
    const l = buf.consume(1);
    const s = buf.consume(l).toString("utf-8");
    console.log(`(${l})"${s}"`);
    return s;
    // return buf.consume(buf.consume(1)).toString("utf-8");
}

/**
 * reads bytecode from a consumable buffer
 * @param {ConsumableBuffer} buf
 * @returns {Buffer}
 */
function getBytecode(buf) {
    const start = buf._pos;
    while (true) {
        const opdat = decodeOp(buf._bytes, buf._pos);
        // console.log(`${buf._pos.toString().padStart(3,'0')} -> ${Object.entries(OPS).find(v => v[1]===opdat.code)[0]} :: ${opdat.length}`);
        buf._pos += opdat.length;
        if (opdat.code === OPS.HLT) {
            return buf._bytes.subarray(start, buf._pos);
        }
    }
}

export class T3VM {
    /**
     * @param {Buffer} buffer
     */
    constructor(buffer) {
        const data = new ConsumableBuffer(buffer);
        const version = data.consume(1);
        if (version !== 0) {
            console.log("HERE");
            console.log(version.toString(10));
            console.log(typeof version);
            throw new Error("bad version");
        }
        this.orig = buffer;
        this.conf = null;
        this.code = null;
        this.data = null;
        this.fmtdstr = null;
        this.parseBuffer(data);
    }
    /**
     * @param {ConsumableBuffer} buf
     */
    parseConf(buf) {
        const d = {};
        d.name = readSStr(buf);
        d.invar = buf.consume(1);
        d.rsome = buf.consume(2).readUint16BE();
        d.rnone = buf.consume(2).readUint16BE();
        return d;
    }
    /**
     * @param {ConsumableBuffer} buf
     */
    parseCode(buf) {
        const d = {};
        while (true) {
            const n7 = buf.peek(7);
            if (n7.length !== 7 || n7.toString("utf-8") === "SECTION") {
                return d;
            }
            const fn = buf.consume(1);
            if (fn in d) {
                throw new Error("duplicate function definition");
            }
            if (fn === 0) {
                d.conparams = new Array(buf.consume(1)).fill(null).map(_ => {return readSStr(buf);});
            }
            d[fn] = getBytecode(buf);
        }
    }
    /**
     * @param {ConsumableBuffer} buf
     */
    parseData(buf) {
        const d = [];
        this.fmtdstr = buf.consume(buf.consume(2).readUInt16BE()).toString("utf-8");
        while (true) {
            const n7 = buf.peek(7);
            if (n7.length === 0 || n7.toString("utf-8") === "SECTION") {
                return d;
            }
            const t = buf.consume(1);
            console.log(t);
            switch (t) {
                case 0:{
                    d.push(Number(buf.consume(8).readBigInt64BE()));
                    break;
                }
                case 1:{
                    d.push(buf.consume(buf.consume(1)).toString("utf-8"));
                    break;
                }
                case 2:{
                    d.push(buf.consume(8).readDoubleBE());
                    break;
                }
                default:{
                    console.log(t);
                    throw new Error("invalid data type");
                }
            }
        }
    }
    /**
     * @param {ConsumableBuffer} buf
     */
    parseBuffer(buf) {
        for (let i = 0; i < 3; i ++) {
            const sd = buf.consume(7).toString("utf-8");
            if (sd !== "SECTION") {
                throw new Error("improper section declaration");
            }
            const sn = buf.consume(5).toString("utf-8", 1);
            if (!["conf","code","data"].includes(sn)) {
                throw new Error("invalid section name");
            }
            if (this[sn]) {
                throw new Error("duplicate section definition");
            }
            if (sn === "conf") {
                this.conf = this.parseConf(buf);
            } else if (sn === "code") {
                this.code = this.parseCode(buf);
            } else {
                this.data = this.parseData(buf);
                console.log(this.data);
            }
        }
    }
    /**
     * @param {number} fn function id to execute
     * @param {VMTarget} obj this object
     * @param  {...any} params function parameters
     * @returns {any|any[]}
     */
    execute(fn, obj, ...params) {
        if (fn < 0 || fn > 3) {
            throw new Error("function does not exist");
        }
        // constructor, does setup on obj
        if (fn === 0) {
            setupVMTarget(this, obj);
        }
        if (!obj.setup) {
            throw new Error("constructor must be the first function executed");
        }
        const code = this.code[fn];
        obj.mem.push(...params);
        obj.mem[6] = [];
        const rlist = [];
        let start = 0;
        let i = 0;
        while (i < 300) {
            let l = decodeOp(code, start);
            const op = doVMOp(code.subarray(start, start+l.length));
            start += l.length;
            switch (op.a) {
                case "fault":
                    throw new Error(op.m);
                case "append":
                    rlist.push(op.v);break;
                case "jump":
                    start = (op.rel?start:0) + op.v;break;
                case "ret":
                    obj.mem.splice(obj.mem[0], params.length);
                    if (fn > 0 && fn < 3) {
                        if (fn === 1) {
                            return flags2TilePosition(rlist[0]).from(rlist.slice(1));
                        }
                        return rlist;
                    }
                    return op.v;
                case "noop":break;
            }
            i ++;
        }
        throw new Error("T3VM exec cycle limit exceeded");
    }
}

/**
 * @param {T3VM} vm
 * @param {VMTarget} obj
 */
export function setupVMTarget(vm, obj) {
    obj.setup = true;
    obj.mem = [7+vm.data.length+vm.conf.invar, 7+vm.data.length, 7, obj, 0, 0, null];
    obj.mem.push(...vm.data);
    obj.mem.push(...new Array(vm.conf.invar).fill(0));
    // obj.regs = new Array(16).fill(0);
    obj.regs = {
        get 14() {
            return 1;
        },
        get 15() {
            return 0;
        },
        set 14(v){},
        set 15(v){}
    };
    for (let i = 0; i < 13; i ++) {
        obj.regs[i] = 0;
    }
    obj.flagreg = 0;
}

/**
 * performs the given operation
 * @param {VMTarget} obj
 * @param {Buffer} op byte code
 * @returns {VMOPAction}
 */
export function doVMOp(obj, op) {
    switch (op[0]) {
        case  0:obj.regs[op[1]>>4] += obj.regs[op[1]&15];break;
        case  1:obj.regs[op[1]&15] = obj.regs[op[1]>>4] + obj.mem[op[2]];break;
        case  2:obj.regs[op[1]>>4] += fromBytes(op, 2, ((op[1]&15) + 1)/2);break;
        case  3:return {a:"append",v:obj.regs[op[1]>>4]};
        case  4:obj.regs[op[1]>>4] -= obj.regs[op[1]&15];break;
        case  5:obj.regs[op[1]&15] = obj.regs[op[1]>>4] - obj.mem[op[2]];break;
        case  6:obj.regs[op[1]>>4] -= fromBytes(op, 2, ((op[1]&15) + 1)/2);break;
        case  7:obj.regs[op[2]>>4] = obj.regs[op[1]>>4][obj.regs[op[1]&15]];break;
        case  8:obj.regs[op[1]>>4] *= obj.regs[op[1]&15];break;
        case  9:obj.regs[op[1]&15] = obj.regs[op[1]>>4] * obj.mem[op[2]];break;
        case 10:obj.regs[op[1]>>4] *= fromBytes(op, 2, ((op[1]&15) + 1)/2);break;
        case 11:obj.regs[op[1]>>4][obj.regs[op[1]&15]] = obj.regs[op[2]>>4];break;
        case 12:case 13:case 14:{
            const rx = op[1]>>4;
            const ry = op[1]&15;
            const n = obj.regs[rx];
            let d;
            switch (op[0]) {
                case 12:d=obj.regs[ry];break;
                case 13:d=obj.mem[op[2]];break;
                case 14:d=fromBytes(op, 3, ((op[2]&15) + 1)/2);break;
            }
            if (d === 0) return {a:"fault",m:"zero division"};
            obj.regs[rx] = n/d;
            obj.regs[ry] = n%d;
            break;
        }
        case 15:obj.mem[6].push(obj.regs[op[1]>>4]);break;
        case 16:case 17:case 18:{
            const rx = op[1]>>4;
            const ry = op[1]&15;
            const n = obj.regs[rx];
            let d;
            switch (op[0]) {
                case 16:d=obj.regs[ry];break;
                case 17:d=obj.mem[op[2]];break;
                case 18:d=fromBytes(op, 3, ((op[2]&15) + 1)/2);break;
            }
            if (d === 0) return {a:"fault",m:"zero division"};
            obj.regs[rx] = Math.floor(n/d);
            obj.regs[ry] = Math.ceil(n/d);
            break;
        }
        case 19:obj.regs[op[1]>>4]=obj.mem[6].pop();break;
        case 20:obj.regs[op[1]>>4]=obj.regs[op[1]&15];break;
        case 21:obj.regs[op[1]>>4]=obj.mem[(op[1]&8)?obj.regs[op[1]&7]:op[2]];break;
        case 22:obj.mem[(op[1]&8)?obj.regs[op[1]&7]:op[2]]=obj.regs[op[1]>>4];break;
        case 23:obj.regs[op[1]>>4]=fromBytes(op, 2, ((op[1]&15) + 1)/2);break;
        case 24:
        case 25:case 26:case 27:
        case 28:case 29:case 30:{
            let v = obj.regs[op[1]>>4];
            if (op[1]&4) {
                v = op.readInt16BE(2);
            }
            const r = [
                true,// JMP
                obj.flagreg&CMPFLAGS.EQ,//JE/JZ
                !((obj.flagreg&CMPFLAGS.EQ)===1),//JNE/JNZ
                obj.flagreg&CMPFLAGS.LESS,//JL
                obj.flagreg&CMPFLAGS.LESSEQ,//JLE
                obj.flagreg&CMPFLAGS.MORE,//JG
                obj.flagreg&CMPFLAGS.MOREEQ//JGE
            ][op[0]-24];
            if (!r) break;
            return {a:"jump",rel:(op[1]&12)!==0,v};
        }
        case 31:return {a:"ret",v:op[1]&15?fromBytes(op, 2, ((op[1]&15) + 1)/2):obj.regs[op[1]>>4]};
        case 32:case 33:case 34:case 35:{
            const a = obj.regs[op[1]>>4];
            let b = [obj.regs[op[1]&15], op[2], fromBytes(op, 2, ((op[1]&15) + 1)/2), 0][op[0]-32];
            let acc = 0;
            if (a === b) acc |= CMPFLAGS.EQ;
            if (a < b) acc |= CMPFLAGS.LESS;
            if (a > b) acc |= CMPFLAGS.MORE;
            obj.flagreg = acc;
            break;
        }
        case 40:obj.regs[op[1]>>5] = obj.regs[op[1]>>5] << op[1]&31;break;
        case 41:obj.regs[op[1]>>5] = obj.regs[op[1]>>5] >> op[1]&31;break;
        case 42:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] & obj.regs[op[1]&15];break;
        case 43:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] & obj.mem[op[2]];break;
        case 44:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] & fromBytes(op, 2, ((op[1]&15) + 1)/2);break;
        case 45:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] | obj.regs[op[1]&15];break;
        case 46:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] | obj.mem[op[2]];break;
        case 47:obj.regs[op[1]>>4] = obj.regs[op[1]>>4] | fromBytes(op, 2, ((op[1]&15) + 1)/2);break;

        case 255:return {a:"fault",m:"HCF"};
    }
    return {a:"noop"};
}

/**
 * @typedef {{a:"noop"}|{a:"ret",v:number}|{a:"append",v:any}|{a:"jump",rel:boolean,v:number}|{a:"fault",m:string}} VMOPAction
 */

/**
 * @enum {number}
 */
export const OPS = {
    ADD: 0,
    SUB: 1,
    MUL: 2,
    DIVMOD: 3,
    IDIV: 4,
    MOV: 5,
    JMP: 6,
    CMP: 7,
    SHL: 8,
    SHR: 9,
    APPEND: 10,
    GET: 11,
    SET: 12,
    RET: 13,
    TEST: 14,
    AND: 15,
    OR: 16,
    PUSH: 17,
    POP: 18,
    HLT: 255
};

/**
 * @typedef {{code: OPS, length: number}} OPData
 */

/**
 * decodes the operation type specified by the byte at start and returns its length
 * @param {Buffer} buf bytes
 * @param {number} start position to decode from
 * @returns {OPData}
 */
export function decodeOp(buf, start) {
    const nx = start+1;
    const n = buf[start];
    if (n === 255) {
        return {code:OPS.HLT,length:1};
    }
    switch (n) {
        case  0:return {code:OPS.ADD,length:2};
        case  1:return {code:OPS.ADD,length:3};
        case  2:return {code:OPS.ADD,length:2+((buf[nx]&15) + 1)/2};
        case  3:return {code:OPS.APPEND,length:2};
        case  4:return {code:OPS.SUB,length:2};
        case  5:return {code:OPS.SUB,length:3};
        case  6:return {code:OPS.SUB,length:2+((buf[nx]&15) + 1)/2};
        case  7:return {code:OPS.GET,length:3};
        case  8:return {code:OPS.MUL,length:2};
        case  9:return {code:OPS.MUL,length:3};
        case 10:return {code:OPS.MUL,length:2+((buf[nx]&15) + 1)/2};
        case 11:return {code:OPS.SET,length:3};
        case 12:return {code:OPS.DIVMOD,length:2};
        case 13:return {code:OPS.DIVMOD,length:3};
        case 14:return {code:OPS.DIVMOD,length:3+((buf[nx+1]&15) + 1)/2};
        case 15:return {code:OPS.PUSH,length:2};
        case 16:return {code:OPS.IDIV,length:2};
        case 17:return {code:OPS.IDIV,length:3};
        case 18:return {code:OPS.IDIV,length:3+((buf[nx+1]&15) + 1)/2};
        case 19:return {code:OPS.POP,length:2};
        case 20:return {code:OPS.MOV,length:2};
        case 21:return {code:OPS.MOV,length:(buf[nx]&15)===0?3:2};
        case 22:return {code:OPS.MOV,length:(buf[nx]&15)===0?3:2};
        case 23:return {code:OPS.MOV,length:2+((buf[nx]&15) + 1)/2};
        case 24:
        case 25:case 26:case 27:
        case 28:case 29:case 30:
            return {code:OPS.JMP,length:(buf[nx]&4)===0?2:4};
        case 31:return {code:OPS.RET,length:2+(((buf[nx]&15)===0)?0:((buf[nx]&15) + 1)/2)};
        case 32:return {code:OPS.CMP,length:2};
        case 33:return {code:OPS.CMP,length:3};
        case 34:return {code:OPS.CMP,length:2+((buf[nx]&15) + 1)/2};
        case 35:return {code:OPS.TEST,length:2};
        case 40:return {code:OPS.SHL,length:2};
        case 41:return {code:OPS.SHR,length:2};
        case 42:return {code:OPS.AND,length:2};
        case 43:return {code:OPS.AND,length:3};
        case 44:return {code:OPS.AND,length:2+((buf[nx]&15) + 1)/2};
        case 45:return {code:OPS.OR,length:2};
        case 46:return {code:OPS.OR,length:3};
        case 47:return {code:OPS.OR,length:2+((buf[nx]&15) + 1)/2};
        default:throw new Error(`invalid opcode (${n}) @ ${start}`);
    }
}

/**
 * @param {Buffer} b
 * @param {number?} s start offset
 * @param {number?} l length
 * @returns {number}
 */
export function fromBytes(b, s, l) {
    if (s+l > b.length) {
        return -1;
    }
    l = l ?? b.length;
    s = s ?? 0;
    let n = 0n;
    for (let i = l-1; i >= 0; i --) {
        n |= BigInt(b[s+i])<<BigInt(8*(l-i-1));
    }
    return Number(n);
}
