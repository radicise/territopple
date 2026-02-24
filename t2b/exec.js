const { readFileSync, writeFileSync, existsSync } = require("fs");
const _path = require("path");
let reverse = false;
const tar = (()=>{
    let t = process.argv[2];
    if (!t) throw new Error("expected target");
    if (t === "-r") {
        reverse = true;
        t = process.argv[3];
    }
    if (t === "-w") {
        t = process.argv[3];
    }
    if (!t) throw new Error("expected target");
    return t;
})();

if (!/\..+?\..+$/.test(tar)) throw new Error("target must have two extensions");
const wtar = tar.slice(0, tar.lastIndexOf("."));
const rpath = _path.join(__dirname, "t", tar);
const wpath = _path.join(__dirname, "b", wtar);
if (!(reverse ? existsSync(wpath) : existsSync(rpath))) throw new Error("File Not Found");

if (reverse) {
    const hex = '0123456789abcdef';
    const data = readFileSync(wpath);
    // const text = [...Uint8Array.from(data)].map((v,i) => `${hex[BigInt(v)>>4n]}${hex[BigInt(v)&15n]}${(i+1)%16===0?'\n':''}`).join(' ');
    const text = [...Uint8Array.from(data)].map((v,i) => `${hex[v>>4]}${hex[v&15]}${(i+1)%16===0?'\n':''}`).join(' ');
    writeFileSync(rpath, text, {encoding:"utf-8"});
    process.exit();
}

const text = readFileSync(rpath, {encoding:"utf-8"}).split("\n").map(v => v.slice(0,v.includes(";")?v.indexOf(";"):undefined)).join(' ').replaceAll("|", ''); // split lines, remove comments, join with spaces
// console.log(text.split(' ').map(v => v.trim()).filter(v => v.length>0).slice(-50));
/**@type {Record<string,number>} */
const MARKERS = {};
let cpos = 0;
const data = text.split(' ').map(v => v.trim()).filter(v => v.length>0).map((v) => {
    if (v[0] === '$') {
        cpos ++;
        return Number.parseInt(v.slice(1).split(/[+_\-]/g).join(''), 2);
    }
    if (v[0] === '~') {
        cpos += v.length - 1;
        return v.slice(1).split("").map(v => v.charCodeAt(0));
    }
    if (v[0] === "#") {
        MARKERS[v] = cpos;
        return [];
    }
    if (v[0] === "%") {
        cpos += Number(v[1]);
        return v.replaceAll("#?", `${cpos}`);
    }
    cpos ++;
    return Number.parseInt(v, 16);
}).flat().map(v => {
    if (typeof v === "number") {
        return v;
    }
    if (v[0] === "%") {
        // console.log(v);
        // console.log(MARKERS);
        for (const marker in MARKERS) {
            v = v.replaceAll(new RegExp(`${marker}(?=[+*/)\\-])`, "g"), `${MARKERS[marker]}`);
        }
        const num = Number(eval(v.slice(2)));
        const r = [];
        for (let i = 0, l = Number(v[1]); i < l; i ++) {
            r.push((num&((0xff)<<(i*8)))>>(i*8));
        }
        return r.reverse();
    }
}).flat();
console.log(MARKERS);
writeFileSync(wpath, Buffer.from(data));
