import { TTVMParser } from "../ttvm/parser.mjs";
import { TTVM } from "../ttvm/vm.mjs";
import * as fs from "fs";
import * as rl from "readline";

const ticks = new Set();
process.argv.forEach(v => {
    if (v[0] !== '-') {
        return;
    }
    for (const c of v.slice(1).split('')) {
        ticks.add(c);
    }
});

const ptest = ticks.has('p');
const etest = ticks.has('e');
const dbugr = ticks.has('d');

const fdata = fs.readFileSync(process.argv[2]);

if (ptest) {
    const parser = TTVMParser.load(fdata);
    
    console.log(parser.version);
    console.log(JSON.stringify(parser.conf));
    console.log(JSON.stringify(parser.data));
    // console.log(JSON.stringify(parser.code));
    console.log(JSON.stringify(parser.indx));
    for (let i = 0; i < 8; i ++) {
        console.log(parser._sectable[i]);
    }

    console.log(parser.copyCode().subarray(0,10).toString("hex"));
}

if (etest) {
    const vm = new TTVM(fdata);

    if (dbugr) {
        const iface = rl.createInterface({input:process.stdin,output:process.stdout});
        iface.setPrompt("\x1b[36m> \x1b[39m");
        vm.debug(iface);
        iface.prompt();
    } else {
        vm.execute("@init", []);
    }
}
