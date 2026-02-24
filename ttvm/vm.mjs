/**
 * @file
 * this file contains code for running TTVM code
 */

import { ConsumableBuffer, TTVMParser, VMTYPE, DATATYPE, PURPOSE, SECTABLE, VMTYPE_NAME } from "./parser.mjs";

const DEF = '\x1b[39m';
const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const BLU = '\x1b[34m';
const PUR = '\x1b[35m';
const color = (c,t) => `${c}${t}${DEF}`;

/**
 * 4Ki
 * @constant 
 */
const STACKSIZE = 1024*4;

/**@enum {number} */
export const VMSEGPFLAGS = {
    READ: 1,
    WRITE: 2,
    EXEC: 4
};

/**
 * @enum {number}
 */
export const VMFAULTCODE = {
    /**
     * generated when a divide by zero occurs
     */
    ZERODIV: 0,
    /**
     * generated when:
     * - attempt to execute nonexecuted memory
     * - attempt to write to nonwriteable memory
     * - attempt to read from nonreadable memory
     * - attempt to read memory that crosses a segment boundary
     */
    SEGMENT: 1,
    /**
     * generated when a miscellaneous invalid state is detected
     */
    GENPROT: 2,
    /**
     * generated when a user cancels execution
     */
    SIGKILL: 3,
    /**
     * generated when the maximum execution time is exceeded
     */
    TIMEOUT: 4,
    /**
     * generated when the maximum execution cycle count is exceeded
     */
    CYCLELIM: 5,
    /**
     * generated when a user runs out of patience
     */
    SIGINT: 6,
    /**
     * generated if another fault is generated during a fault handler
     */
    DBLFLT: 7,
};

/**
 * whether TTVM code is allowed to register a handler for the given fault
 * @type {VMFAULTCODE[]}
 */
const VMFAULT_DYNHANDLE_ALLOWED = [
    VMFAULTCODE.ZERODIV,
    VMFAULTCODE.TIMEOUT,
    VMFAULTCODE.CYCLELIM,
    VMFAULTCODE.SIGINT,
];

const PREFIX_BIT = 0x40;

/**
 * masks for the possible modifer codes
 * @enum {number}
 */
const VM_OPMODS = {
    SIZE: 0x40,
    ERA: 0x44,
    CALL: 0x45,
    OPREV: 0x46,
    MEMOFFSET: 0x48,
    SIGN: 0x50,
    FPOP: 0x51,
};

/**
 * vm operation types
 * @enum {number}
 */
const VM_OPS = {
    ADD: 0,
    SUB: 1,
    MUL: 2,
    DIV: 3,
    SHL: 4,
    SHR: 5,
    SAR: 6,
    XOR: 7,
    ORR: 9,
    AND: 10,
    PSH: 11,
    POP: 12,
    CMP: 13,
    XCHG: 14,
    CMPXCHG: 15,
    JMP: 16,
    RET: 17,
    SYSCALL: 18,
    MOV: 19,
    HLT: 20,
};

const VM_OP_NAMES = {};
Object.entries(VM_OPS).forEach(v => VM_OP_NAMES[v[1]]=v[0]);

/**
 * @typedef {{mem:Buffer,p:VMSEGPFLAGS}} VMMemorySegment
 */
/**
 * @description
 * - args[0] src reg
 * - args[1] src mem
 * - args[2] src imm
 * - args[3] dst [0,reg]|[1,mem]
 * @typedef VM_OPARGS
 * @type {[number[],number[],number[],[number,number]]}
 */
/**
 * @enum {number}
 */
const OPK = {
    R:0,
    M:1,
    I:2,
};
/**
 * @typedef {(OPK|[OPK,number,0|1])} VM_OPARG_SPEC
 */

/**
 * @enum {[VM_OPS,...VM_OPARG_SPEC]}
 */
const CPS = {
    EC_RR0:[OPK.R,OPK.R],//(era compat) rx.ry->rx
    EC_RM0:[OPK.R,OPK.M],//(era compat) rx.mz->rx
    EC_RI0:[OPK.R,OPK.I],//(era compat) rx,iz->rx
    RR0:[[OPK.R,4],[OPK.R,4]],//rx.ry->rx
    RM0:[[OPK.R,4],[OPK.M,4,1]],//rx.mz->rx
    RI0:[[OPK.R,4],[OPK.I,4,1]],//rx.iz->rx
};

/**
 * @type {Record<number,[VM_OPS,VM_OPARG_SPEC[]]}>}
 */
const VM_OPARG_PATTERNS = {
    0:[VM_OPS.ADD,CPS.EC_RR0],
    1:[VM_OPS.ADD,CPS.EC_RM0],
    2:[VM_OPS.ADD,CPS.EC_RI0],
    3:[VM_OPS.SUB,CPS.EC_RR0],
    4:[VM_OPS.SUB,CPS.EC_RM0],
    5:[VM_OPS.SUB,CPS.EC_RI0],
    6:[VM_OPS.MUL,CPS.EC_RR0],
    7:[VM_OPS.MUL,CPS.EC_RM0],
    8:[VM_OPS.MUL,CPS.EC_RI0],
    12:[VM_OPS.DIV,CPS.EC_RR0],
    13:[VM_OPS.DIV,CPS.EC_RM0],
    14:[VM_OPS.DIV,CPS.EC_RI0],
    15:[VM_OPS.SHL,CPS.RR0],
    16:[VM_OPS.SHR,CPS.RR0],
    17:[VM_OPS.SAR,CPS.RR0],
    18:[VM_OPS.XOR,CPS.RR0],
    19:[VM_OPS.XOR,CPS.RM0],
    20:[VM_OPS.XOR,CPS.RI0],
    21:[VM_OPS.ORR,CPS.RR0],
    22:[VM_OPS.ORR,CPS.RM0],
    23:[VM_OPS.ORR,CPS.RI0],
    24:[VM_OPS.AND,CPS.RR0],
    25:[VM_OPS.AND,CPS.RM0],
    26:[VM_OPS.AND,CPS.RI0],
    27:[VM_OPS.PSH,[[OPK.R,8]]],
    28:[VM_OPS.POP,[[OPK.R,8]]],
    29:[VM_OPS.CMP,CPS.EC_RR0],
    30:[VM_OPS.CMP,CPS.EC_RM0],
    31:[VM_OPS.CMP,CPS.EC_RI0],
    32:[VM_OPS.XCHG,CPS.RR0],
    33:[VM_OPS.CMPXCHG,CPS.RR0],
    42:[VM_OPS.SYSCALL,[]],
    43:[VM_OPS.MOV,CPS.EC_RR0],
    44:[VM_OPS.MOV,CPS.RM0],
    45:[VM_OPS.MOV,CPS.RI0],
    46:[VM_OPS.MOV,CPS.EC_RR0],
};

/**
 * @enum {number}
 */
const CFLAGS = {
    ZX: 0,
    NZ: 1,
    LX: 2,
    BX: 3,
    AX: 4,
    GX: 5,
};

/**
 * @typedef {"reg"|"gpr"|"fpr"|"ror"|"cvr"|"smr"} VMDUMP_REG
 * reg is all registers
 * gpr is all gp registers
 * fpr is all fp registers
 * ror is all readonly registers
 * cvr is all const value registers
 * smr is all specific meaning registers
 */

const DBGR_FLAGS = {"TRACE_INST_PARSE":false};

const DUMP_ALLOWED = true;

export class TTVM {
    /**
     * @enum {number}
     * @readonly
     */
    static #REGISTERS = Object.freeze({
        R0: 0,
        R1: 1,
        R2: 2,
        R3: 3,
        R4: 4,
        R5: 5,
        R6: 6,
        R7: 7,
        R8: 8,
        R9: 9,
        R10: 10,
        R11: 11,
        R12: 12,
        ONES: 13,
        ONE: 14,
        ZERO: 15,
        SP: 16,
        BP: 17,
        PC: 18,
        CF: 19,
        RF0: 20,
        RF1: 21,
        RF2: 22,
        RF3: 23,
        RF4: 24,
        RF5: 25,
    });
    // register name pad length for dump alignment
    static #RN_PL = Math.max(...Object.keys(this.#REGISTERS).map(v=>v.length));
    /**@readonly */
    static #RO_REGISTERS = [this.#REGISTERS.ONES, this.#REGISTERS.ONE, this.#REGISTERS.ZERO, this.#REGISTERS.PC, this.#REGISTERS.CF];
    /**@readonly */
    static #CONST_REGISTERS = [this.#REGISTERS.ONES, this.#REGISTERS.ONE, this.#REGISTERS.ZERO];
    /**@readonly */
    static #FP_REGISTERS = [this.#REGISTERS.RF0,this.#REGISTERS.RF1,this.#REGISTERS.RF2,this.#REGISTERS.RF3,this.#REGISTERS.RF4,this.#REGISTERS.RF5];
    /**@readonly */
    static #GP_REGISTERS = [this.#REGISTERS.R0,this.#REGISTERS.R1,this.#REGISTERS.R2,this.#REGISTERS.R3,this.#REGISTERS.R4,this.#REGISTERS.R5,this.#REGISTERS.R6,this.#REGISTERS.R7,this.#REGISTERS.R8,this.#REGISTERS.R9,this.#REGISTERS.R10,this.#REGISTERS.R11,this.#REGISTERS.R12];
    /**@readonly */
    static #SM_REGISTERS = [this.#REGISTERS.BP,this.#REGISTERS.SP,,this.#REGISTERS.CF,this.#REGISTERS.PC];
    /**
     * @type {VMMemorySegment[]}
     * @description
     * a[0]=code
     * a[1]=invar
     * a[2]=data
     * a[3]=stack
     * all other entries are the result of dynamic allocations
     */
    #memory_segments;
    /**
     * @type {Buffer}
     */
    #registers;
    /**
     * prevents constant registers from being clobbered accidentally
     * @type {boolean} 
     */
    #rconst_lock;
    /**@type {VMFAULTCODE} */
    #fault = -1;
    #debugger = false;
    #last_types = {};
    /**
     * @param {Buffer} raw
     */
    constructor(raw) {
        this.info = TTVMParser.load(raw);
        const rc = Math.max(...Object.values(TTVM.#REGISTERS));
        this.#registers = Buffer.alloc(8*rc+8);
        for (let i = 0; i < rc; i ++) {
            this.#last_types[i] = VMTYPE.U32;
        }
        this.#rconst_lock = false;
        this.#writeReg(TTVM.#REGISTERS.ONES, 0xffffffffffffffffn, VMTYPE.U64);
        this.#writeReg(TTVM.#REGISTERS.ONE, 1, VMTYPE.U8);
        this.#rconst_lock = true;
        this.#memory_segments = [
            {p:VMSEGPFLAGS.EXEC,mem:this.info.copyCode()},
            {p:VMSEGPFLAGS.READ,mem:Buffer.alloc(this.info.conf.invar_count*4)},
            {p:VMSEGPFLAGS.READ|VMSEGPFLAGS.WRITE,mem:Buffer.allocUnsafe(this.info.data.datavars.reduce((pv,v)=>pv+(v.type===DATATYPE.STRING?v.value.length:(v.type===DATATYPE.F64BE?8:(v.type===DATATYPE.S32BE?4:v.value))),0))},
            {p:VMSEGPFLAGS.READ|VMSEGPFLAGS.WRITE,mem:Buffer.alloc(STACKSIZE)}];
        {
            let c = 0;
            for (const dv of this.info.data.datavars) {
                switch (dv.type) {
                    case (DATATYPE.S32BE): {
                        this.#memory_segments[2].mem.writeInt32BE(dv.value, c);
                        c += 4;
                        break;
                    }
                    case (DATATYPE.STRING): {
                        this.#memory_segments[2].mem.write(dv.value, c, "ascii");
                        c += dv.value.length;
                        break;
                    }
                    case (DATATYPE.F64BE): {
                        this.#memory_segments[2].mem.writeDoubleBE(dv.value, c);
                        c += 8;
                        break;
                    }
                    case (DATATYPE.UNINIT): {
                        this.#memory_segments[2].mem.fill(0, c, c+dv.value);
                        c += dv.value;
                        break;
                    }
                }
            }
        }
    }
    get purpose() {return this.info.conf.purpose;}
    /**
     * @param {Buffer} buf
     * @param {number} loc
     * @param {VMTYPE} type
     * @returns {number|bigint}
     */
    static readType(buf, loc, type) {
        type = type ?? VMTYPE.U64;
        switch (type) {
            case (VMTYPE.F32): return buf.readFloatBE(loc);
            case (VMTYPE.F64): return buf.readDoubleBE(loc);
            case (VMTYPE.U64): return buf.readBigUint64BE(loc);
            case (VMTYPE.S64): return buf.readBigInt64BE(loc);
            // pointers are U32 in V1
            case (VMTYPE.PTR): // move this to be above whatever type a pointer is
            case (VMTYPE.U32): return buf.readUint32BE(loc);
            case (VMTYPE.IPTR):
            case (VMTYPE.S32): return buf.readInt32BE(loc);
            case (VMTYPE.U16): return buf.readUint16BE(loc);
            case (VMTYPE.S16): return buf.readInt16BE(loc);
            case (VMTYPE.U8): return buf.readUint8(loc);
            case (VMTYPE.S8): return buf.readInt8(loc);
            default: throw new Error("Invalid Concrete Type");
        }
    }
    /**
     * @param {Buffer} buf
     * @param {number} loc
     * @param {number|bigint} value
     * @param {VMTYPE} type
     * @returns {number|bigint}
     */
    static writeType(buf, loc, value, type) {
        type = type ?? VMTYPE.U64;
        switch (type) {
            case (VMTYPE.F32): return buf.writeFloatBE(value, loc);
            case (VMTYPE.F64): return buf.writeDoubleBE(value, loc);
            case (VMTYPE.U64): return buf.writeBigUint64BE(value, loc);
            case (VMTYPE.S64): return buf.writeBigInt64BE(value, loc);
            // pointers are U32 in V1
            case (VMTYPE.PTR): // move this to be above whatever type a pointer is
            case (VMTYPE.U32): return buf.writeUint32BE(value, loc);
            case (VMTYPE.S32): return buf.writeInt32BE(value, loc);
            case (VMTYPE.U16): return buf.writeUint16BE(value, loc);
            case (VMTYPE.S16): return buf.writeInt16BE(value, loc);
            case (VMTYPE.U8): return buf.writeUint8(value, loc);
            case (VMTYPE.S8): return buf.writeInt8(value, loc);
            default: throw new Error("Invalid Concrete Type");
        }
    }
    /**
     * returns the size of a concrete type in bytes
     * @param {VMTYPE} type
     * @returns {number}
     */
    static sizeof(type) {
        switch (type) {
            case VMTYPE.U128:case VMTYPE.S128:return 16;
            case VMTYPE.U64:case VMTYPE.S64:case VMTYPE.DOUBLE:return 8;
            case VMTYPE.U32:case VMTYPE.S32:case VMTYPE.PTR:case VMTYPE.IPTR:case VMTYPE.F32:return 4;
            case VMTYPE.U16:case VMTYPE.S16:return 2;
            case VMTYPE.U8:case VMTYPE.S8:return 1;
        }
        throw new Error("Invalid Concrete Type");
    }
    /**
     * @param {number} seg
     * @returns {number}
     */
    #getSegmentOffset(seg) {
        let a = 0;
        for (let i = 0; i < seg; i ++) {
            a += this.#memory_segments[i].mem.length;
        }
        return a;
    }
    /**
     * @param {number} reg
     * @param {VMTYPE} type
     * @returns {number|bigint}
     */
    #readReg(reg, type) {
        type = type ?? VMTYPE.U64;
        let loc = reg * 8;
        switch (type) {
            case (VMTYPE.U32): case (VMTYPE.PTR): case (VMTYPE.S32): case (VMTYPE.F32): {
                loc += 4;
                break;
            }
            case (VMTYPE.U16): case (VMTYPE.S16): {
                loc += 6;
                break;
            }
            case (VMTYPE.U8): case (VMTYPE.S8): {
                loc += 7;
                break;
            }
        }
        return TTVM.readType(this.#registers, loc, type);
    }
    /**
     * returns false if the operation failed
     * a GENPROT fault MUST be raised if this returns false
     * @param {number} reg
     * @param {number|bigint} value
     * @param {VMTYPE} type
     * @returns {boolean}
     */
    #writeReg(reg, value, type) {
        if (this.#rconst_lock && TTVM.#CONST_REGISTERS.includes(reg)) {
            return false;
        }
        type = type ?? VMTYPE.U64;
        this.#last_types[reg] = type;
        let loc = reg * 8;
        switch (type) {
            case (VMTYPE.U32): case (VMTYPE.PTR): case (VMTYPE.S32): case (VMTYPE.F32): {
                loc += 4;
                break;
            }
            case (VMTYPE.U16): case (VMTYPE.S16): {
                loc += 6;
                break;
            }
            case (VMTYPE.U8): case (VMTYPE.S8): {
                loc += 7;
                break;
            }
        }
        TTVM.writeType(this.#registers, loc, value, type);
        return true;
    }
    /**
     * returns true if the write was allowed
     * @param {number} loc
     * @param {boolean} isreg
     * @param {number|bigint} value
     * @param {VMTYPE} type
     * @returns {boolean}
     */
    #tryWrite(loc, isreg, value, type) {
        if (!isreg) {
            const seg = this.#getSegment(loc);
            if (seg.p&VMSEGPFLAGS.WRITE) {
                const off = this.#offsetLoc(loc);
                if (off+TTVM.sizeof(type) > seg.mem.length) {
                    return false;
                }
                TTVM.writeType(seg.mem, off, value, type);
                return true;
            }
            return false;
        } else {
            if (TTVM.#RO_REGISTERS.includes(loc)) {
                return false;
            }
            this.#writeReg(loc, 0n, VMTYPE.U64);
            // if (!TTVM.#FP_REGISTERS.includes(loc)) {
            //     value = Math.trunc(value);
            // } else {
            //     type = TTVM.sizeof(type)===32?VMTYPE.F32:VMTYPE.F64;
            // }
            this.#writeReg(loc, value, type);
            return true;
        }
    }
    /**
     * @param {number} loc
     * @param {boolean} isreg
     * @param {VMTYPE} type
     * @returns {number|bigint|null}
     */
    #tryRead(loc, isreg, type) {
        if (!isreg) {
            const seg = this.#getSegment(loc);
            if (seg.p&VMSEGPFLAGS.READ) {
                const off = this.#offsetLoc(loc);
                if (off+TTVM.sizeof(type) > seg.mem.length) {
                    return null;
                }
                return TTVM.readType(seg.mem, off, type);
            }
            return null;
        } else {
            // if (TTVM.#FP_REGISTERS.includes(loc)) {
            //     return this.#readReg(loc, (type===VMTYPE.U32|type===VMTYPE.S32)?VMTYPE.F32:VMTYPE.F64);
            // }
            return this.#readReg(loc, type);
        }
    }
    get #sp() {return Number(this.#readReg(TTVM.#REGISTERS.SP, VMTYPE.U64));}
    get #bp() {return Number(this.#readReg(TTVM.#REGISTERS.BP, VMTYPE.U64));}
    get #pc() {return Number(this.#readReg(TTVM.#REGISTERS.PC, VMTYPE.U64));}
    set #sp(v) {this.#writeReg(TTVM.#REGISTERS.SP, BigInt(v), VMTYPE.U64);}
    set #bp(v) {this.#writeReg(TTVM.#REGISTERS.BP, BigInt(v), VMTYPE.U64);}
    set #pc(v) {this.#writeReg(TTVM.#REGISTERS.PC, BigInt(v), VMTYPE.U64);}
    /**
     * @param {CFLAGS} f
     * @returns {boolean}
     */
    #readCFlag(f) {
        f = BigInt(f);
        return (this.#readReg(TTVM.#REGISTERS.CF, VMTYPE.U64)&(1n<<f)) !== 0n;
    }
    /**
     * @param {CFLAGS} f
     * @param {boolean} v
     */
    #writeCFlag(f,v) {
        f = BigInt(f);
        let l = this.#readReg(TTVM.#REGISTERS.CF, VMTYPE.U64);
        l &= ~(1n<<f);
        l |= (v?1n:0n)<<f;
        this.#writeReg(TTVM.#REGISTERS.CF, l, VMTYPE.U64);
    }
    /**
     * returns the segment containing the specified memory address
     * @param {number} loc memory address
     * @returns {VMMemorySegment}
     */
    #getSegment(loc) {
        for (const seg of this.#memory_segments) {
            if (loc < seg.mem.length) {
                return seg;
            }
            loc -= seg.mem.length;
        }
        return null;
    }
    /**
     * returns the index of the segment containing the specified memory address
     * @param {number} loc memory address
     * @returns {number}
     */
    #getSegmentIndex(loc) {
        let i = 0;
        for (const seg of this.#memory_segments) {
            if (loc < seg.mem.length) {
                return i;
            }
            i ++;
            loc -= seg.mem.length;
        }
        return null;
    }
    /**
     * returns the offset into the section that `loc` is within that corresponds to `loc`
     * @param {number} loc memory address
     * @returns {number}
     */
    #offsetLoc(loc) {
        for (const seg of this.#memory_segments) {
            if (loc < seg.mem.length) {
                return loc;
            }
            loc -= seg.mem.length;
        }
        throw new Error("location out of bounds, cannot calculate segment offset");
    }
    #setup_exec() {
        throw new Error("TODO");
    }
    /**
     * returns true if execution can continue
     * execution MUST abort if this returns false
     * @param {VMFAULTCODE} fault
     */
    #setup_faulthandler(fault) {
        if (VMFAULT_DYNHANDLE_ALLOWED.includes(fault)) {
            throw new Error("fault handlers not set up yet");
        }
        return false;
    }
    #execute() {
        let cycles = 0;
        main: while (!cycles || !this.#debugger) {
            if (cycles >= 5) {
                throw new Error("CYCLE LIMIT EXCEEDED");
            }
            cycles ++;
            const CPC = this.#pc; // current program counter, store in variable because there is a non-trivial cost to reading it
            const PC_seg = this.#getSegment(CPC); // segment that PC is in
            const PC_segi = this.#getSegmentIndex(CPC);
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log("INST PARSE HEAD");
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(`CPC: ${CPC}`);
            if (!(PC_seg?.p&VMSEGPFLAGS.EXEC)) { // check PC points to executable memory
                console.log("ERROR SEGV");
                // goto the segfault handler
                if (this.#setup_faulthandler()) continue;
                return;
            }
            let relPC = this.#offsetLoc(CPC); // PC relative to segment start
            let PIB = PC_seg.mem[relPC]; // primary instruction byte, contains the opcode of the instruction
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(`rpc: ${relPC} opib: ${PIB}`);
            let modifiers = {size:2,era:false,call:false,oprev:false,memoffset:0,sign:false,fpop:false};
            while (PIB & PREFIX_BIT) { // check if instruction is a prefix
                if ((PIB & VM_OPMODS.SIZE) === VM_OPMODS.SIZE) {
                    modifiers.size = PIB & 3;
                } else if (PIB === VM_OPMODS.ERA) {
                    modifiers.era = true;
                } else if (PIB === VM_OPMODS.CALL) {
                    modifiers.call = true;
                } else if (PIB === VM_OPMODS.OPREV) {
                    modifiers.oprev = true;
                } else if ((PIB & VM_OPMODS.MEMOFFSET) === VM_OPMODS.MEMOFFSET) {
                    modifiers.memoffset = PIB&7;
                    if (PIB&7 === 1) {
                        relPC ++;
                        const rv = PC_seg.mem[relPC];
                        if (!(rv & PREFIX_BIT)) { // illegal modifier
                            if (this.#setup_faulthandler()) continue main;
                            return;
                        }
                        modifiers.memoffset |= ((rv&0x3f) << 8);
                    }
                } else if (PIB === VM_OPMODS.SIGN) {
                    modifiers.sign = true;
                } else if (PIB === VM_OPMODS.FPOP) {
                    modifiers.fpop = true;
                }
                relPC ++;
                PIB = PC_seg.mem[relPC];
            }
            relPC ++;
            let memoffsetval;
            switch (modifiers.memoffset&7) {
                case 1:memoffsetval=this.#readReg(modifiers.memoffset>>8,VMTYPE.PTR);break;
                case 3:memoffsetval=this.#getSegmentOffset(2);break;
                case 4:memoffsetval=this.#getSegmentOffset(1);break;
            }
            let mantype = [VMTYPE.U8,VMTYPE.U16,VMTYPE.U32,VMTYPE.U64][modifiers.size];
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(`rpc: ${relPC} fpib: ${PIB}`);
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(JSON.stringify(modifiers));
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(VMTYPE_NAME[mantype]);
            let bitoff = 0;
            let bytoff = 0;
            /**
             * @param {OPK} kind register|memory|immediate
             * @param {number} size size in bits, defaults to interpreting based on context
             * @param {boolean} align if true, the offset will be increased if needed to be byte aligned after reading
             * @returns {number}
             */
            const readarg = (kind, size, align) => {
                if (typeof size !== "number") {
                    switch (kind) {
                        case 0:
                            size = modifiers.era ? 8 : 4;
                            break;
                        case 1:
                            size = 4*(2<<readarg(0, modifiers.era ? 8 : 4));
                            break;
                        case 2:
                            size = 4*(2<<readarg(0, modifiers.era ? 8 : 4));
                            break;
                        default: throw new Error("invalid kind parameter for readarg");
                    }
                }
                const os = size;
                if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(`RAS: ${size}`);
                let n = 0;
                while (size + bitoff > 8) {
                    const cs = 8-bitoff;
                    size -= cs;
                    n |= ((PC_seg.mem[relPC+bytoff]&(((0xff<<bitoff)&0xff)>>bitoff))<<size);
                    bitoff = 0;
                    bytoff ++;
                }
                const vb = PC_seg.mem[relPC+bytoff];
                const ones = (~((0xff>>size)<<size))&0xff;
                const mask = ((ones<<(8-size-bitoff))&0xff);
                if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(`vb: ${vb} ones: ${ones} mask: ${mask}`);
                bitoff += size;
                n |= (vb&mask)>>(8-bitoff);
                if (bitoff === 8 || (align && bitoff > 0)) {
                    bitoff = 0;
                    bytoff ++;
                }
                if (modifiers.memoffset !== 0) {
                    const b = Buffer.allocUnsafe(TTVM.sizeof(PTR));
                    TTVM.writeType(b, 0, n, VMTYPE.PTR);
                    n = TTVM.readType(b, 0, TTVM.sizeof(PTR)===4?VMTYPE.S32:VMTYPE.S64);
                }
                return n;

            };
            /**
             * @param {...VM_OPARG_SPEC} pattern argument kinds
             * @returns {VM_OPARGS}
             */
            function readargs(...pattern) {
                let al = [[],[],[]];
                if (pattern.length === 0) return al;
                for (let i = 0; i < pattern.length; i ++) {
                    let t,s,a;
                    if (typeof pattern[i] !== "number") {
                        t = pattern[i][0];
                        s = pattern[i][1];
                        a = pattern[i][2];
                    } else {
                        t = pattern[i];
                    }
                    let v = readarg(t, s, a);
                    if (t === OPK.M && modifiers.memoffset !== 0) {
                        v += memoffsetval;
                    }
                    al[t].push(v);
                }
                return al;
            }
            const k = VM_OPARG_PATTERNS[PIB];
            if(DBGR_FLAGS.TRACE_INST_PARSE)console.log(k);
            /**@type {VM_OPS} */
            let op; // operation to perform
            /**
             * @type {VM_OPARGS}
             */
            let args; // arguments to the operation
            let jmpa; // info for jump / ret opcodes
            if (!k) {
                args = [[],[],[]];
                switch (PIB) {
                    case 34:case 35:case 36:
                    case 37:case 38:case 39:
                    case 40:
                        op=VM_OPS.JMP;
                        args[0]=[readarg(0,4)];
                        args[1]=[];
                        args[2]=[];
                        const r=(PC_seg.mem[relPC+bytoff]&8)===8,i=(PC_seg.mem[relPC+bytoff]&4)===4,a=(PC_seg.mem[relPC+bytoff]&2)===2,s=(PC_seg.mem[relPC+bytoff]&1)===1;
                        if (DBGR_FLAGS.TRACE_INST_PARSE) {
                            console.log(`JMPPARSE:\nb: ${PC_seg.mem[relPC+bytoff]} r: ${r} i: ${i} a: ${a} s: ${s}`);
                        }
                        bytoff ++;
                        bitoff = 0;
                        if (i) {
                            args[2].push(TTVM.readType(PC_seg.mem,relPC+bytoff,VMTYPE.S16));
                            bytoff += 2;
                        }
                        jmpa={r,i,a,s};
                        break;
                    case 41:
                        op=VM_OPS.RET;
                        break;
                    case 63:
                        op = VM_OPS.HLT;
                        break;
                }
            } else {
                op = k[0];
                args = readargs(...k[1]);
            }
            if(DBGR_FLAGS.TRACE_INST_PARSE){
                console.log(`byte offset: ${bytoff} rpc: ${relPC} segoff: ${this.#getSegmentOffset(PC_segi)} segi: ${PC_segi}`);
            }
            this.#pc = this.#getSegmentOffset(PC_segi) + relPC + bytoff;
            if(DBGR_FLAGS.TRACE_INST_PARSE){
                console.log(`PC: ${this.#pc}`);
                console.log(VM_OP_NAMES[op]);
                console.log(args);
            }
            let acc = modifiers.size===3 ? 0n : 0;
            /**
             * runs f on each operand
             * @param {(v:number|bigint,k:OPK)=>void} f
             * @param {(v:number|bigint,k:OPK)=>number|bigint} accinit whether the acc variable should be initialized to the value of the first parameter
             */
            function accumulate(f,accinit) {
                if (accinit) acc = null;
                for (const r of args[0]) {
                    if (acc===null){acc=accinit(r,OPK.R);continue;}
                    f(r, OPK.R);
                }
                for (const m of args[1]) {
                    if (acc===null){acc=accinit(m,OPK.M);continue;}
                    f(m, OPK.M);
                }
                for (const i of args[2]) {
                    if (acc===null){acc=accinit(i,OPK.I);continue;}
                    f(i, OPK.I);
                }
            }
            const fpeqtype = modifiers.size === 2 ? VMTYPE.F32 : VMTYPE.F64;
            /**
             * @param {(a:number|bigint,b:number|bigint)=>number|bigint} f
             * @param {boolean} i
             * @returns {Array<(v:number|bigint,k:OPK)=>void>}
             */
            const arithacc = (f,i) => {
                return [
                    (v,k) => {
                        acc=f(
                            acc,
                            k===OPK.R?
                            (
                                this.#tryRead(v,true,(modifiers.fpop&&TTVM.#FP_REGISTERS.includes(v))?fpeqtype:mantype)
                            ):(
                                k===OPK.M?
                                this.#tryRead(v,false,mantype)
                                :(modifiers.size===3?BigInt(v):v)
                            )
                        );
                    },
                    (!i)?undefined:(v,k)=>{
                        return k===OPK.R?
                        (
                            this.#tryRead(v,true,(modifiers.fpop&&TTVM.#FP_REGISTERS.includes(v))?fpeqtype:mantype)
                        ):(
                            k===OPK.M?
                            this.#tryRead(v,false,mantype)
                            :(size===3?BigInt(v):v)
                        );
                    }
                ];
            };
            /**
             * @param {(a:number|bigint,b:number|bigint)=>number|bigint} f
             * @param {boolean} i
             * @returns {Array<(v:number|bigint,k:OPK)=>void>}
             */
            const logiacc = (f,i) => {
                return [
                    (v,k) => {
                        acc=f(
                            acc,
                            k===OPK.R?
                            (
                                this.#tryRead(v,true,mantype)
                            ):(
                                k===OPK.M?
                                this.#tryRead(v,false,mantype)
                                :(modifiers.size===3?BigInt(v):v)
                            )
                        );
                    },
                    (!i)?undefined:(v,k)=>{
                        return k===OPK.R?
                        (
                            this.#tryRead(v,true,mantype)
                        ):(
                            k===OPK.M?
                            this.#tryRead(v,false,mantype)
                            :(size===3?BigInt(v):v)
                        );
                    }
                ];
            };
            const readArgVal = (v,k,n) => {
                return k === OPK.R?
                (
                    this.#tryRead(v, true, (n&&modifiers.fpop&&TTVM.#FP_REGISTERS.includes(v))?fpeqtype:mantype)
                ):(
                    k === OPK.M?
                    this.#tryRead(v,false,mantype)
                    :(size===3?BigInt(v):v)
                )
            };
            const picktype = (r) => (TTVM.#FP_REGISTERS.includes(r)&&modifiers.fpop)?fpeqtype:mantype;
            switch (op) {
                case VM_OPS.ADD: {
                    accumulate(...arithacc((a,b)=>a+b));
                    this.#tryWrite(args[0][0], true, acc, picktype(args[0][0]));
                    break;
                }
                case VM_OPS.SUB: {
                    accumulate(...arithacc((a,b)=>a-b));
                    this.#tryWrite(args[0][0], true, acc, picktype(args[0][0]));
                    break;
                }
                case VM_OPS.MUL: {
                    accumulate(...arithacc((a,b)=>a*b,true));
                    this.#tryWrite(args[0][0], true, acc, picktype(args[0][0]));
                    break;
                }
                case VM_OPS.DIV: {
                    accumulate(...arithacc((a,b)=>a/b,true));
                    this.#tryWrite(args[0][0], true, acc, picktype(args[0][0]));
                    break;
                }
                case VM_OPS.SHL: {
                    const val = this.#tryRead(args[0][0], true, mantype) << this.#tryRead(args[0][1], true, mantype);
                    this.#tryWrite(args[0][0], true, val);
                    break;
                }
                case VM_OPS.SHR: {
                    const val = this.#tryRead(args[0][0], true, mantype) >>> this.#tryRead(args[0][1], true, mantype);
                    this.#tryWrite(args[0][0], true, val);
                    break;
                }
                case VM_OPS.SAR: {
                    const val = this.#tryRead(args[0][0], true, mantype) >> this.#tryRead(args[0][1], true, mantype);
                    this.#tryWrite(args[0][0], true, val);
                    break;
                }
                case VM_OPS.XOR: {
                    accumulate(...logiacc((a,b)=>a^b,true));
                    this.#tryWrite(args[0][0], true, acc, mantype);
                    break;
                }
                case VM_OPS.ORR: {
                    accumulate(...logiacc((a,b)=>a|b,true));
                    this.#tryWrite(args[0][0], true, acc, mantype);
                    break;
                }
                case VM_OPS.AND: {
                    accumulate(...logiacc((a,b)=>a&b,true));
                    this.#tryWrite(args[0][0], true, acc, mantype);
                    break;
                }
                case VM_OPS.PSH: {
                    const sz = TTVM.sizeof(mantype);
                    this.#sp -= sz;
                    this.#tryWrite(this.#sp, false, this.#readReg(args[0][0], mantype));
                    break;
                }
                case VM_OPS.POP: {
                    const sz = TTVM.sizeof(mantype);
                    this.#tryWrite(args[0][0], true, this.#tryRead(this.#sp, false, mantype), mantype);
                    this.#sp += sz;
                    break;
                }
                case VM_OPS.CMP: {
                    const vals = [];
                    for (const it of args[0]) vals.push(readArgVal(it, OPK.R, true));
                    for (const it of args[1]) vals.push(readArgVal(it, OPK.M));
                    for (const it of args[2]) vals.push(readArgVal(it, OPK.I));
                    let mt = mantype;
                    mantype = [VMTYPE.S8,VMTYPE.S16,VMTYPE.S32,VMTYPE.S64][modifiers.size];
                    for (const it of args[0]) vals.push(readArgVal(it, OPK.R, true));
                    for (const it of args[1]) vals.push(readArgVal(it, OPK.M));
                    for (const it of args[2]) vals.push(readArgVal(it, OPK.I));
                    this.#writeReg(TTVM.#REGISTERS.CF, 0n, VMTYPE.U64);
                    mantype = mt;
                    if (vals[0] === vals[1]) {
                        this.#writeCFlag(CFLAGS.ZX, true);
                    } else {
                        this.#writeCFlag(CFLAGS.NZ, true);
                    }
                    if (vals[0] < vals[1]) {
                        this.#writeCFlag(CFLAGS.BX, true);
                    } else if (vals[0] > vals[1]) {
                        this.#writeCFlag(CFLAGS.AX, true);
                    }
                    if (vals[2] < vals[3]) {
                        this.#writeCFlag(CFLAGS.LX, true);
                    } else if (vals[2] > vals[3]) {
                        this.#writeCFlag(CFLAGS.GX, true);
                    }
                    break;
                }
                case VM_OPS.XCHG: {
                    const vals = [];
                    for (const it of args[0]) vals.push(readArgVal(it, OPK.R));
                    this.#tryWrite(args[0][0], true, vals[1], mantype);
                    this.#tryWrite(args[0][1], true, vals[0], mantype);
                    break;
                }
                case VM_OPS.CMPXCHG: {
                    const vals = [];
                    for (const it of args[0]) vals.push(readArgVal(it, OPK.R));
                    for (const it of args[1]) vals.push(readArgVal(it, OPK.M));
                    if (vals[0] === vals[2]) {
                        // this.#tryWrite(args[0][1], true, vals[3], mantype);
                        this.#tryWrite(args[1][1], false, vals[1], mantype);
                    }
                    break;
                }
                case VM_OPS.RET: {
                    const sz = TTVM.sizeof(VMTYPE.PTR);
                    this.#pc = this.#tryRead(this.#sp, false, VMTYPE.PTR);
                    this.#sp += sz;
                    break;
                }
                case VM_OPS.JMP: {
                    let j = false;
                    switch (PIB) {
                        case 34: { // JMP
                            j = true;
                            break;
                        }
                        case 35: { // JZ
                            j = this.#readCFlag(CFLAGS.ZX);
                            break;
                        }
                        case 36: { // JNZ
                            j = this.#readCFlag(CFLAGS.NZ);
                            break;
                        }
                        case 37: { // JL/B
                            j = this.#readCFlag(jmpa.s?CFLAGS.BX:CFLAGS.LX);
                            break;
                        }
                        case 38: { // JL/BE
                            j = this.#readCFlag(CFLAGS.ZX)||this.#readCFlag(jmpa.s?CFLAGS.BX:CFLAGS.LX);
                            break;
                        }
                        case 39: { // JG/A
                            j = this.#readCFlag(jmpa.s?CFLAGS.AX:CFLAGS.GX);
                            break;
                        }
                        case 40: { // JG/AE
                            j = this.#readCFlag(CFLAGS.ZX)||this.#readCFlag(jmpa.s?CFLAGS.AX:CFLAGS.GX);
                            break;
                        }
                    }
                    if(DBGR_FLAGS.TRACE_INST_PARSE){
                        console.log(`JCOND: ${j}`);
                        console.log(jmpa);
                    }
                    if (!j) break;
                    /**@type {number} */
                    let dst = jmpa.i?args[2][0]:this.#tryRead(args[0][0], true, VMTYPE.PTR);
                    if (jmpa.r) {
                        dst += this.#pc;
                    }
                    if (modifiers.call) {
                        const sz = TTVM.sizeof(VMTYPE.PTR);
                        this.#sp -= sz;
                        this.#tryWrite(this.#sp, false, this.#pc, VMTYPE.PTR);
                        if (jmpa.a) {
                            this.#pc = dst;
                        } else {
                            this.#pc = this.info.indx.entries[dst].offset;
                        }
                    } else {
                        this.#pc = dst;
                    }
                    break;
                }
                case VM_OPS.MOV: {
                    switch (PIB) {
                        case 43: { // MOV rx,ry
                            let vs = this.#tryRead(args[0][1], true, picktype(args[0][1]));
                            let vd = this.#tryRead(args[0][0], true, picktype(args[0][0]));
                            if (DBGR_FLAGS.TRACE_INST_PARSE)console.log(`vs: ${vs} vd: ${vd}`);
                            if (TTVM.#FP_REGISTERS.includes(args[0][1]) && modifiers.fpop) {
                                vs = Math.trunc(vs);
                            }
                            if (TTVM.#FP_REGISTERS.includes(args[0][0]) && modifiers.fpop) {
                                vd = Math.trunc(vd);
                            }
                            if (DBGR_FLAGS.TRACE_INST_PARSE)console.log(`vs: ${vs} vd: ${vd}`);
                            if (modifiers.oprev) {
                                this.#tryWrite(args[0][1], true, vd, picktype(args[0][1]));
                            } else {
                                this.#tryWrite(args[0][0], true, vs, picktype(args[0][0]));
                            }
                            break;
                        }
                        case 44: { // MOV rx,mz
                            const vs = this.#tryRead(args[1][0], false, mantype);
                            let vd = this.#tryRead(args[0][0], true, picktype(args[0][0]));
                            if (TTVM.#FP_REGISTERS.includes(args[0][0]) && modifiers.fpop) {
                                vd = Math.trunc(vd);
                            }
                            if (modifiers.oprev) {
                                this.#tryWrite(args[1][0], false, vd, mantype);
                            } else {
                                this.#tryWrite(args[0][0], true, vs, mantype);
                            }
                            break;
                        }
                        case 45: { // MOV rx,iz
                            this.#tryWrite(args[0][0], true, args[2][0], mantype);
                            break;
                        }
                        case 46: { // MOV rx,[ry]
                            const maddr = this.#tryRead(args[0][1], true, VMTYPE.PTR);
                            const xval = this.#tryRead(args[0][0], true, mantype);
                            if (modifiers.oprev) {
                                this.#tryWrite(maddr, false, xval, mantype);
                            } else {
                                this.#tryWrite(args[0][0], true, this.#tryRead(maddr, false, mantype), mantype);
                            }
                            break;
                        }
                    }
                    break;
                }
                case VM_OPS.HLT: {
                    if (modifiers.call) {
                        if (DUMP_ALLOWED) {
                            this.#dump_core();
                        } else {
                            throw new SecurityViolationError("CORE DUMP NOT ALLOWED");
                        }
                    }
                    throw new Error("TTVM HALT ENCOUNTERED");
                }
            }
        }
    }
    /**
     * @param {string} symbol
     * @param {Array<[any,VMTYPE]>} params
     * @returns {any}
     */
    execute(symbol, params) {
        const entry = this.info.indx.entries.find(v=>v.symbol===symbol);
        if (!entry) {
            throw new Error("symbol does not exist");
        }
        this.#pc = entry.offset;
        this.#execute();
    }
    /**
     * info:
     * - 'srv' single register val, specify register in xtra
     * - 'mem' memory dump, specify region in xtra
     * @param {VMDUMP_REG|"srv"|"mem"} info info to dump
     * @param {any} xtra
     * @returns {string}
     */
    #dump(info, xtra) {
        const lines = [];
        const fmt_rv = (k) => {
            const o = TTVM.#REGISTERS[k];
            const n = `${k}:`;
            const r = this.#registers.subarray(o*8,o*8+8);
            return `${n.padEnd(TTVM.#RN_PL+1,' ')} ${r.readBigUInt64BE().toString(16).padStart(16, '0')} (${this.#readReg(o,this.#last_types[o])})`;
        };
        switch (info) {
            case "gpr":case "cvr":case "fpr":case "ror":case "smr":
            case "reg": {
                let keys = Object.keys(TTVM.#REGISTERS);
                // console.log(info);
                switch (info) {
                    case "cvr":keys=keys.filter(v=>TTVM.#CONST_REGISTERS.includes(TTVM.#REGISTERS[v]));break;
                    case "fpr":keys=keys.filter(v=>TTVM.#FP_REGISTERS.includes(TTVM.#REGISTERS[v]));break;
                    case "gpr":keys=keys.filter(v=>TTVM.#GP_REGISTERS.includes(TTVM.#REGISTERS[v]));break;
                    case "ror":keys=keys.filter(v=>TTVM.#RO_REGISTERS.includes(TTVM.#REGISTERS[v]));break;
                    case "smr":keys=keys.filter(v=>TTVM.#SM_REGISTERS.includes(TTVM.#REGISTERS[v]));break;
                }
                // console.log(keys);
                for (const k of keys.sort((a,b)=>TTVM.#REGISTERS[a]-TTVM.#REGISTERS[b])) {
                    lines.push(fmt_rv(k));
                }
                break;
            }
            case "srv": {
                lines.push(fmt_rv(xtra));
                break;
            }
            case "mem": {
                lines.push("MEMDUMP NOT IMPL");
                break;
            }
        }
        return lines.join('\n');
    }
    #dump_core() {
        const dump = {
            regs:this.#dump("reg"),
        };
        console.log("REGISTERS:");
        console.log(dump.regs);
    }
    /**
     * runs the TTVM in debugger mode
     * @param {import("readline").Interface} iface
     */
    debug(iface) {
        this.#debugger = true;
        const help = _helpmap(0);
        const metahelp = _helpmap(1);
        const vmhelp = _helpmap(2);
        iface.on("line", (l) => {
            const parts = l.trim().split(" ");
            switch (parts[0].trim().toLowerCase()) {
                case "quit":
                case "q": {
                    process.exit();
                }
                case "step":
                case "s": {
                    this.#execute();
                    break;
                }
                case "brk":case "brkpoint":
                case "b": {
                    console.log("breakpoints not implemented yet");
                    break;
                }
                case "exec":
                case "e": {
                    this.execute(parts[1]);
                    break;
                }
                case "dump":
                case "d": {
                    if (parts.length === 1) {
                        this.#dump_core();
                    } else {
                        const out = this.#dump(parts[1]);
                        console.log(out.length?out:`${PUR}no output${DEF}`);
                    }
                    break;
                }
                case "dumpreg":
                case "dr": {
                    if (parts.length === 1) {
                        console.log(`${RED}specify register${DEF}`);
                        break;
                    }
                    const k = parts[1].trim().toUpperCase();
                    if (!(k in TTVM.#REGISTERS)) {
                        console.log(color(RED,`'${k}' is not a register`));
                    } else {
                        const out = this.#dump("srv", k);
                        console.log(out.length?out:color(PUR,"no output"));
                    }
                    break;
                }
                case "flag":
                case "f": {
                    if (parts.length < 3) {
                        console.log(color(YEL,"syntax is 'f [cst] {flag}'"));
                        break;
                    }
                    const op = parts[1].trim().toLowerCase();
                    const flag = parts[2].trim().toUpperCase();
                    if (!(flag in DBGR_FLAGS)) {
                        console.log(color(RED,`'${flag}' is not a flag`));
                        console.log(color(BLU,"use 'h f' for help on flags"));
                        break;
                    }
                    switch (op) {
                        case 'c':DBGR_FLAGS[flag]=false;break;
                        case 's':DBGR_FLAGS[flag]=true;break;
                        case 't':DBGR_FLAGS[flag]=!DBGR_FLAGS[flag];break;
                        default:
                            console.log(color(RED,`'${op}' is not a valid operation`)+'\n'+color(BLU,"use 'h f' for help on flags"));
                            break;
                    }
                    break;
                }
                case "?":
                case "help":
                case "h": {
                    let topic = null;
                    let hf = help;
                    if (parts.length === 1) {
                        topic = "@default";
                    } else {
                        if (parts[1].startsWith("--")) {
                            switch (parts[1].toLowerCase()) {
                                case "--debugger":break;
                                case "--help":hf = metahelp;break;
                                case "--vm":hf = vmhelp;break;
                                default:
                                    hf = null;
                                    break;
                            }
                            if (hf === null) {
                                console.log(color(YEL,"unrecognized knowledge base")+'\n'+color(BLU,"use 'h --help kb' for a list of knowledge bases"));
                                break;
                            } else {
                                if (parts.length < 3) {
                                    topic = "@default";
                                } else {
                                    topic = parts[2].toLowerCase();
                                }
                            }
                        } else {
                            topic = parts[1].toLowerCase();
                        }
                    }
                    const h = hf(topic);
                    if (!h) {
                        console.log(color(YEL,"unknown topic")+'\n'+color(BLU,"use 'h --help topics' for help"));
                        break;
                    }
                    const c = process.stdout.columns;
                    let cindent = 0;
                    let calign = 0;
                    let alignchar = '';
                    let pstr='',astr='',istr=0;
                    const partition = (s,i) => {return [s.slice(0,i),s.slice(i)]};
                    /**
                     * @param {string} l
                     * @param {number} i
                     * @param {boolean} _
                     * @returns {string[]}
                     */
                    const ff = (l,i,_) => {
                        switch (l.split(" ",1)[0].slice(0,3)) {
                            case"#i+":cindent ++;return [];
                            case"#i-":cindent --;return [];
                            case"#a=":
                                let {ac,pstr:pstrv,astr:astrv,istr:istrv} = parseAlignOpts(l);
                                alignchar = ac;pstr = pstrv;astr = astrv;istr = istrv;
                                h.slice(i).find(v=>{if(v==="#a:")return true;calign=Math.max(calign, v.indexOf(alignchar));return false;});return [];
                            case"#a:":calign=0;return [];
                        }
                        if (!_ && calign) {
                            l = partition(l,l.indexOf(alignchar));
                            l[0] = l[0].padEnd(calign, ' ')+pstr;
                            l[1] = alignchar + astr + l[1].slice(alignchar.length);
                            l = l.join("");
                        }
                        l = "    ".repeat(cindent) + l;
                        const spacep = l.slice(0,c).lastIndexOf(" ");
                        const cutp = (c-spacep)<10?spacep:c;
                        return (l.length>c?[l.slice(0,cutp),ff((calign?" ".repeat(calign+pstr.length+alignchar.length+astr.length+((c-spacep)<10?istr:2)):"    ")+l.slice(cutp).trim(),i,true)].flat():l);
                    };
                    console.log(h.map((v,i)=>ff(v.trimEnd(),i)).flat(2).join('\n'));
                    break;
                }
                case "arbc":case "code":
                case "c": {
                    const segments = this.#memory_segments;
                    const that = this;
                    try {
                        console.log(eval(l.slice(2)));
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
            iface.prompt();
        });
    }
}

/**
 * @param {number} kbi
 * @returns {(topic:string)=>string[]}
 */
function _helpmap(kbi) {
    const data = Object.entries(kbs[kbi]).map(v=>[v[0].split(","),v[1]]);
    return (topic) => {return (data.find(v=>v[0].includes(topic))??[])[1];};
}
/**
 * @typedef _PAO_PCR
 * @type {{f:string,a:string[]|_PAO_PCR[]}}
 */
/**
 * parses alignment options
 * @param {string} l
 * @returns {{ac:string,pstr:string,astr:string,istr:number}}
 */
function parseAlignOpts(l) {
    let ac = l[3];
    let pstr = '';
    let astr = '';
    let istr = 0;
    let optstr = l.split(" ").slice(1).join(" ");
    if (!optstr) {
        return {ac,pstr,astr,istr};
    }
    /**
     * @param {string} s
     * @param {number} o
     * @param {number} d
     * @returns {[_PAO_PCR[], number]}
     */
    const pcalls = (s,o,d) => {
        d = d ?? 0;o = o ?? 0;
        // console.log(`HEAD ${d}`);
        // console.log(`${o}: ${s.slice(o)}.`)
        /**@type {_PAO_PCR[]}*/
        let build = [];
        let i = o;
        let lc = s[i];
        i ++;
        let pushlc = true;
        while (i<s.length) {
            const c = s[i];
            i ++;
            if (c === '(') {
                pushlc = false;
                let [call, ni] = pcalls(s, i, d+1);
                i = ni;
                // console.log(call);
                // console.log(`${s.slice(i)}.`);
                build.push({f:lc,a:call});
            } else if (c === ')') {
                if (pushlc)build.push(lc);
                pushlc = true;
                // console.log(build);
                // console.log(`TAILa ${d}`);
                return [build, i];
            } else {
                if (pushlc)build.push(lc);
                pushlc = true;
            }
            lc = c;
        }
        // console.log(build);
        // console.log(`TAILb ${d}`);
        return [build, i];
    };
    const pcs = pcalls(optstr)[0];
    // console.log(pcs);
    const D = pcs.find(v => v.f === 'd');
    const P = pcs.find(v => v.f === 'p');
    const I = pcs.find(v => v.f === 'i');
    /**
     * @param {_PAO_PCR} call
     * @returns {string}
     */
    const makestr = (call) => {
        // console.log(call);
        return call.a[0].repeat(Number(call.f));
    };
    if (D) {
        ac = `${makestr(D.a[0])}${ac}${makestr(D.a[1])}`;
    }
    if (P) {
        pstr = makestr(P.a[0]);
        astr = makestr(P.a[1]);
    }
    if (I) {
        istr = Number(I.a[0]);
    }
    return {ac,pstr,astr,istr};
}

export class SecurityViolationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "SecurityViolationError";
    }
}

const STDAL = "#a=- d(1( )1( ))p(1( )1( ))";
const STDALI = STDAL + "i(2)";
const ENDAL = "#a:";
const IND = "#i+";
const UND = "#i-";

const _help = {
    "help,@default":
        [
            "How To Read A Help Page:",
            IND,
            "Help pages all follow a basic structure, they are broken into sections with indented content",
            "Each section is either self-explanatory, or provides further details on something referenced in a previous section",
            "Use 'h --help topics' for a list of more specific information available",
            UND,
        ],
    "topics":
        [
            "Help Topics:",
            IND,
            "help (@) - help interpreting help pages",
            "usage - how to interpret usage specifications",
            "lists - how to interpret lists of topics",
            "dynexpr - how to interpret dynamic expressions",
            UND,
        ],
    "usage":
        [
            "Interpreting Usage Examples:",
            "#i+",
            "Many help pages include usage syntax or examples, they are interpreted as follows:",
            "#a=- d(1( )1( ))p(1( )1( ))i(2)",
            "(A|B|C|...|etc) - any of the exact values A, B, C, ..., etc",
            "{parameter} - required parameter, there will usually be a section about the purpose of the parameter and what it does",
            "{--parameter} - a parameter preceeded by '--', otherwise identical to normal parameters",
            "{parameter?} - optional parameter",
            "{parameter?=default} - a parameter with a default value",
            "{p?=dyn $expr} - a parameter with a default determined dynamically, use 'h --help dynexpr' for details",
            "[abc] - required value that can be any non-empty subset of the characters a, b, c",
            "[abc]? - optional value that can be any subset of the characters a, b, c",
            "#a:",
            "#i-",
        ],
    "lists":
        [
            "Interpreting Topic Lists:",
            "#i+",
            "Topic lists list the topics available in a knowledge base, they are accessed using 'h {--kb} topics'",
            "An entry in the topic list takes on the following form:",
            "#i+",
            "{cannonical name} (alt1,alt2,...)? - {summary}",
            "#i-",
            "the 'cannonical name' is the cannon name of the topic",
            "'alt1', 'alt2', and so on are aliases that refer to the same cannon topic, the special alt name '@' denotes that the topic is the default topic shown for that knowledge base",
            "'summary' is a short description of what information the topic page contains",
            "#i-",
        ],
    "dynexpr":
        [
            "Dynamic Expressions:",
            "#i+",
            "Some defaults may be determined dynamically, dynamic expressions allow this behavior to be made explicit where convenient",
            "All dynamic expressions (dynexprs) begin with 'dyn $(' and end with the matched parenthesis ')'",
            "Dynexprs are interpreted as javascript expressions with the following special meanings:",
            "#a=- d(1( )1( ))",
            "%REG - the value of the register REG (see 'help --vm regs' for information about registers)",
            "?? - omitted expression, this is used in cases where the specific value of the default is not important, but the default is still dynamic, a '??' will only ever appear as the entire expression ('dyn $(??)')",
            "#a:",
            "#i-",
        ],
};
        
const _debugger = {
    "topics":
        [
            "Debugger Topics:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "help (h,?,@) - help information",
            "flag (f) - debugger flags",
            "quit (q) - quit command",
            "step (s) - step through execution",
            "brk (b,brkpoint) - breakpoints",
            "exec (e) - setup execution at symbol",
            "dump (d) - dump vm internal state",
            "dumpreg (dr) - dump the value of a single register",
            "arbc (c,code) - execute javascript code",
            "#a:",
            "#i-",
        ],
    "h,help,?,@default":
        [
            "USAGE:",
            "(h|help|?) {--kb?} {topic?=help}",
            "#i+",
            "Displays help on the specified topic, use 'h {--kb} topics' to see all topics",
            "Parameter 'kb' is used to select a knowledge base to access, see below for details",
            "#i-",
            "KB:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "--vm - knowledge base for VM details, use 'h --vm' for more information",
            "--debugger - knowledge base for debugger usage, this is the default knowledge base",
            "--help - knowledge base for help usage, use 'h --help' for more information",
            "#a:",
            "#i-",
        ],
    "f,flag":
        [
            "USAGE:",
            "(f|flag) (c|s|t) {flag}",
            "#i+",
            "Modifies the specified debugger flag",
            "#i-",
            "OPTIONS:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "c - clears the flag",
            "s - sets the flag",
            "t - toggles the flag",
            "#a:",
            "#i-",
            "FLAGS:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "TRACE_INST_PARSE (false) - show information that allows tracing how instructions are being parsed",
            "#a:",
            "#i-",
        ],
    "q,quit":
        [
            "USAGE:",
            "(q|quit)",
            "#i+",
            "Quits the debugger",
            "#i-",
        ],
    "s,step":
        [
            "USAGE:",
            "(s|step) {n?=1}",
            "#i+",
            "Runs the VM for n execution cycles",
            "#i-",
        ],
    "b,brk,brkpoint":
        [
            "USAGE:",
            "(b|brk|brkpoint) {name?=dyn $(%PC)}",
            "#i+",
            "Sets a breakpoint at the current instruction",
            "If a name is not provided, the current value of the PC register is used instead",
            "#i-",
        ],
    "e,exec":
        [
            "USAGE:",
            "(e|exec) {symbol}",
            "#i+",
            "Sets up the VM to begin execution at the specified symbol",
            "#i-",
        ],
    "d,dump":
        [
            "USAGE:",
            "(d|dump) {info?}",
            "#i+",
            "Dumps the specified information",
            "If info is omitted, the VM performs a core dump",
            "#i-",
            "INFO:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "reg - dumps the values of all registers",
            "gpr - dumps the values of all general purpose registers",
            "fpr - dumps the values of all floating point registers",
            "ror - dumps the values of all readonly registers",
            "cvr - dumps the values of all constant value registers",
            "smr - dumps the values of all specific meaning registers",
            "mem - dumps memory",
            "#a:",
            "#i-",
            "Output Format:",
            IND,
            "Any dumped registers will be output in the following manner:",
            IND,
            "{name}: {hexval} ({cval})",
            UND,
            "'name' is the cannonical name of the register",
            "'hexval' is the hexadecimal representation of the register contents",
            "'cval' is the content of the register interpreted as the same type that was last written to it (use 'h --vm types' for details)",
            "As an example, the register RF0 might be output as the following:",
            IND,
            "RF0: 4029000000000000 (12.5)",
            UND,
            UND,
        ],
    "dr,dumpreg":
        [
            "USAGE:",
            "(dr|dumpreg) {reg}",
            "#i+",
            "Dumps the specified VM register, see 'h --vm registers' for details",
            "See the 'Output Format' section of the dump help page ('h dump') for output format",
            "#i-",
        ],
    "c,arbc,code":
        [
            "USAGE:",
            "(c|arbc|code) {code}",
            "#i+",
            "Interprets the rest of the input as Javascript code and executes it, displaying the result",
            "Note: this command is advanced, and is only meant to be used by those that understand what they are doing",
            "#i-",
            "Local Variables:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "segments - VM memory segments",
            "that - the VM object",
            "#a:",
            "#i-",
        ],
};
const _vm = {
    "help,@default":
        [
            "VM knowledge base, use 'h --vm topics' for a list of topics",
        ],
    "topics":
        [
            "VM Topics:",
            "#i+",
            "#a=- d(1( )1( ))p(1( )1( ))",
            "help (@) - help for this knowledge base",
            "registers (regs) - help with registers",
            "memory (mem) - help with memory",
            "types - help with vm types",
            "tstruct - help with transparent structures",
            "#a:",
            "#i-",
        ],
    "tstruct":
        [
            "Transparent structs are not currently defined in the spec, so there is no help page for them yet",
        ],
    "types":
        [
            "VM Types:",
            IND,
            "The TTVM operates on several concrete and abstract types,",
            "Abstract types are types that imply a specific data format, but cannot be manipulated directly",
            "Concrete types are types that can be manipulated directly with instructions",
            "All concrete types are stored in big endian representation",
            UND,
            "Concrete Types:",
            IND,
            STDAL,
            "PTR - a U32 value that represents a memory address",
            "S8 - a signed 8 bit value",
            "S16 - a signed 16 bit value",
            "S32 - a signed 32 bit value",
            "S64 - a signed 64 bit value",
            "U8 - an unsigned 8 bit value",
            "U16 - an unsigned 16 bit value",
            "U32 - an unsigned 32 bit value",
            "U64 - an unsigned 64 bit value",
            "F32 - a single precision IEEE 754 floating point value",
            "F64 - a double precision IEEE 754 floating point value",
            ENDAL,
            UND,
            "Abstract Types:",
            IND,
            STDAL,
            "VOID - this type is theoretically 0 bits and has no value, functions that return void will return garbage data",
            "SSTR - a short string, the first byte is the string length as a U8 value",
            "LSTR - a long string, the first two bytes are the string length as a U16 value",
            "S128 - a signed 128 bit value",
            "U128 - an unsigned 128 bit value",
            "SIZEDARR[T] - a sized array with length up to 63 containing items of type T, the length is encoded in the type itself",
            "UNSIZEDARR[T] - an unsized array containing items of type T",
            "OPAQUE STRUCT - a data structure without a self-describing format",
            "TRANSPARENT STRUCT - a data structure with a self-describing format per the spec (see 'h --vm tstruct' for details)",
            ENDAL,
            UND,
        ],
    "registers,regs":
        [
            "VM Registers:",
            IND,
            "The TTVM implements registers as specified by the ttvm opcodes specification",
            UND,
            "Register Types:",
            IND,
            STDAL,
            "gpr - general purpose registers, most operations are allowed to act on them",
            "fpr - floating point registers, most operations are allowed to act on them",
            "ror - read only registers, write operations will fail when done from user code",
            "cvr - constant value registers, a subset of the ror group that have constant values defined by the spec",
            "smr - special meaning registers, these registers have meanings defined by the spec",
            ENDAL,
            UND,
            "Registers:",
            IND,
            "This is a list of the cannonical names of the registers, use these names for commands such as 'dr'",
            "R0 (gpr)",
            "R1 (gpr)",
            "R2 (gpr)",
            "R3 (gpr)",
            "R4 (gpr)",
            "R5 (gpr)",
            "R6 (gpr)",
            "R7 (gpr)",
            "R8 (gpr)",
            "R9 (gpr)",
            "R10 (gpr)",
            "R11 (gpr)",
            "R12 (gpr)",
            STDAL,
            "ONES (ror,cvr) - always has all bits set",
            "ONE (ror,cvr) - always contains the value 1",
            "ZERO (ror,cvr) - always contains the value 0",
            "SP (smr) - stack pointer",
            "BP (smr) - base pointer",
            "PC (ror,smr) - program counter, contains the address of the current instruction",
            "CF (ror,smr) - compare flags, contains the results of a comparison",
            ENDAL,
            "RF0 (fpr)",
            "RF1 (fpr)",
            "RF2 (fpr)",
            "RF3 (fpr)",
            "RF4 (fpr)",
            "RF5 (fpr)",
            UND,
        ],
    "memory,mem":
        [
            "Coming soon",
        ]
};
const kbs = [_debugger,_help,_vm];
