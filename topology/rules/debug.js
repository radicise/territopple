import { readFileSync, existsSync } from "fs";
import * as rl from "readline";
import { join } from "path";
import { setupVMTarget, decodeOp, doVMOp, T3VM, OPS, fromBytes } from "./runner.js";

if (process.argv.length < 3) {
    throw new Error("no target");
}

const fpath = join(process.cwd(), process.argv[2]);
if (!existsSync(fpath)) {
    throw new Error("file not found");
}

function exit(bad) {
    process.exit(bad?1:0);
}

const vm = new T3VM(readFileSync(fpath));

const cli = rl.createInterface(process.stdin, process.stdout);
const {readLine, question, waitLine} = (() => {
    /**@type {Function[]} */
    const waits = [];
    /**@type {string[]} */
    const lines = [];
    let qr = null;
    async function waitLine() {
        cli.setPrompt("");
        await readLine();
        cli.setPrompt("> ");
    }
    /**
     * @returns {Promise<string>}
     */
    async function readLine() {
        cli.prompt();
        if (lines.length) {
            return lines.splice(0, 1)[0];
        }
        return await new Promise((r)=>{waits.push(r);});
    }
    async function question(query) {
        console.log(query);
        cli.prompt();
        return await new Promise(r => {qr=r;});
    }
    cli.on("line", (input) => {
        if (input === ".quit") {
            exit();
        }
        if (qr) {
            qr(input);
            qr = null;
        } else {
            if (waits.length) {
                waits.splice(0, 1)[0](input);
            } else {
                lines.push(input);
            }
        }
    });
    return {readLine, question, waitLine};
})();

const procDat = {
    /**@type {T3VM} */
    vm:null,
    /**@type {number} */
    fn:null,
    /**@type {Buffer} */
    code:null,
    /**@type {import("./runner").VMTarget} */
    obj:null,
    /**@type {any[]} */
    params:null,
    /**@type {any[]} */
    rlist:[],
    /**@type {number} */
    start:0,
    /**@type {number} */
    cycle:0,
    /**
     * @param {{vm:T3VM,fn:number,code:Buffer,obj:import("./runner").VMTarget,params:any[]}} v
     */
    set all(v) {
        this.vm = v.vm;
        this.fn = v.fn;
        this.code = v.code;
        this.obj = v.obj;
        this.params = v.params;
        this.rlist = [];
        this.start = 0;
        this.cycle = 0;
    }
};

const HOOKS = {
    DECODE:0,
    POSTEXEC:1
};

let contall = false;

/**
 * @param {number} hook
 * @param {import("./runner").OPData|import("./runner").VMOPAction} o
 */
async function interactHook(hook, o) {
    if (hook === HOOKS.DECODE) {
        console.log(`EXEC CYCLE: ${procDat.cycle.toString(10).padStart(3, '0')}`);
        console.log(`${[...procDat.code.subarray(procDat.start,procDat.start+o.length)].map(v=>v.toString(2).padStart(8, '0')).join(' ')}`);
        console.log(formatOperation(procDat.code, procDat.start));
        // console.log(`${Object.entries(OPS).find(v => v[1]===o.code)[0]} :: ${o.length}`);
        if (contall) return;
        while (true) {
            const comm = await readLine();
            if (comm.startsWith(";")) {
                console.log(eval(comm.slice(1)));
            } else {
                if (comm === ".ca") {
                    contall = true;
                }
                return;
            }
        }
    }
};

/**
 * @param {T3VM} vm
 * @param {number} fn function id to execute
 * @param {VMTarget} obj this object
 * @param  {any[]} params function parameters
 * @returns {any|any[]}
 */
async function execute(vm, fn, obj, params) {
    if (fn < 0 || fn > 3) {
        throw new Error("function does not exist");
    }
    // constructor, does setup on obj
    if (fn === 0) {
        setupVMTarget(vm, obj);
    }
    if (!obj.setup) {
        throw new Error("constructor must be the first function executed");
    }
    const code = vm.code[fn];
    procDat.all = {vm, fn, code, obj, params};
    obj.mem.push(...params);
    obj.mem[6] = [];
    const rlist = procDat.rlist;
    while (procDat.cycle < 300) {
        const l = decodeOp(code, procDat.start);
        await interactHook(HOOKS.DECODE, l);
        const op = doVMOp(obj, code.subarray(procDat.start, procDat.start+l.length));
        procDat.start += l.length;
        switch (op.a) {
            case "fault":
                throw new Error(op.m);
            case "append":
                rlist.push(op.v);break;
            case "jump":
                procDat.start = (op.rel?procDat.start:0) + op.v;break;
            case "ret":
                obj.mem.splice(obj.mem[0], params.length);
                contall = false;
                if (fn > 0 && fn < 3) {
                    return rlist;
                }
                return op.v;
            case "noop":break;
        }
        procDat.cycle ++;
    }
    throw new Error("T3VM exec cycle limit exceeded");
}

async function main() {
    console.log("T3R DEBUGGER");
    console.log(`VM (${vm.conf.name.length})"${vm.conf.name}" LOADED`);
    const tar = {};
    setupVMTarget(vm, tar);
    while (true) {
        console.log("MAIN HEAD");
        const id = Number(await question("Enter Function ID:"));
        if (isNaN(id) || id < 0 || id > 3) {
            continue;
        }
        let params = [];
        if (id > 0) {
            params.push(Number(await readLine()));
        }
        if (id === 1) {
            params.push(Number(await readLine()));
        }
        if (id === 0) {
            let i = 0;
            while (i < vm.code.conparams.length) {
                const v = Number(await question(vm.code.conparams[i]));
                if (isNaN(v)) {
                    continue;
                }
                params.push(v);
                i ++;
            }
        }
        console.log(await execute(vm, id, tar, params));
    }
}

main();


/**
 * @param {Buffer} buf
 * @param {number} x
 * @returns {string}
 */
function formatOperation(buf, ox) {
    const x = ox + 1;
    switch (buf[ox]) {
        case  0:return `ADD r${buf[x]>>4}, r${buf[x]&15}`;
        case  1:return `ADD r${buf[x]&15}, r${buf[x]>>4}, m${buf[x+1]}`;
        case  2:return `ADD r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case  3:return `APPEND r${buf[x]>>4}`;
        case  4:return `SUB r${buf[x]>>4}, r${buf[x]&15}`;
        case  5:return `SUB r${buf[x]&15}, r${buf[x]>>4}, m${buf[x+1]}`;
        case  6:return `SUB r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case  7:return `GET r${buf[x+1]>>4}, r${buf[x]>>4}, r${buf[x]&15}`;
        case  8:return `MUL r${buf[x]>>4}, r${buf[x]&15}`;
        case  9:return `MUL r${buf[x]&15}, r${buf[x]>>4}, m${buf[x+1]}`;
        case 10:return `MUL r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case 11:return `SET r${buf[x+1]>>4}, r${buf[x]>>4}, r${buf[x]&15}`;
        case 12:return `DIVMOD r${buf[x]>>4}, r${buf[x]&15}`;
        case 13:return `DIVMOD r${buf[x]>>4}, r${buf[x]&15}, m${buf[x+1]}`;
        case 14:return `DIVMOD r${buf[x]>>4}, r${buf[x]&15}, ${fromBytes(buf, x+2, ((buf[x+1]&15) + 1)/2)}`;
        case 15:return `PUSH r${buf[x]>>4}`;
        case 16:return `IDIV r${buf[x]>>4}, r${buf[x]&15}`;
        case 17:return `IDIV r${buf[x]>>4}, r${buf[x]&15}, m${buf[x+1]}`;
        case 18:return `IDIV r${buf[x]>>4}, r${buf[x]&15}, ${fromBytes(buf, x+2, ((buf[x+1]&15) + 1)/2)}`;
        case 19:return `POP r${buf[x]>>4}`;
        case 20:return `MOV r${buf[x]>>4}, r${buf[x]&15}`;
        case 21:return `MOV r${buf[x]>>4}, `+((buf[x]&8)?`*r${buf[x]&7}`:`m${buf[x+1]}`);
        case 22:return "MOV "+((buf[x]&8)?`*r${buf[x]&7}`:`m${buf[x+1]}`)+`, r${buf[x]>>4}`;
        case 23:return `MOV r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case 24:
        case 25:case 26:case 27:
        case 28:case 29:case 30:return ((buf[x]&12)?"R":"")+["JMP","JE","JNE","JL","JLE","JG","JGE"][buf[ox]-24]+" "+((buf[x]&4)?`${buf.readInt16BE(x+1)}`:`r${buf[x]>>4}`);
        case 31:return "RET "+((buf[x]&15)?`${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`:`r${buf[x]>>4}`);
        case 32:return `CMP r${buf[x]>>4}, r${buf[x]&15}`;
        case 33:return `CMP r${buf[x]>>4}, m${buf[x+1]}`;
        case 34:return `CMP r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case 35:return `TEST r${buf[x]>>4}`;
        case 40:return `SHL r${buf[x]>>5}, ${buf[x]&31}`;
        case 41:return `SHR r${buf[x]>>5}, ${buf[x]&31}`;
        case 42:return `AND r${buf[x]>>4}, r${buf[x]&15}`;
        case 43:return `AND r${buf[x]&15}, m${buf[x+1]}`;
        case 44:return `AND r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case 45:return `OR r${buf[x]>>4}, r${buf[x]&15}`;
        case 46:return `OR r${buf[x]&15}, m${buf[x+1]}`;
        case 47:return `OR r${buf[x]>>4}, ${fromBytes(buf, x+1, ((buf[x]&15) + 1)/2)}`;
        case 255:return "HLT";
        default:return "BAD OPERATION";
    }
}
