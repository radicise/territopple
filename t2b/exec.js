const { readFileSync, writeFileSync, existsSync } = require("fs");
const _path = require("path");

const tar = process.argv[2];
if (!tar) throw new Error("expected target");

if (!/\..+?\..+$/.test(tar)) throw new Error("target must have two extensions");
const wtar = tar.slice(0, tar.lastIndexOf("."));
const rpath = _path.join(__dirname, "t", tar);
const wpath = _path.join(__dirname, "b", wtar);
if (!existsSync(rpath)) throw new Error("File Not Found");

const text = readFileSync(rpath, {encoding:"utf-8"}).split("\n").map(v => v.slice(0,v.indexOf(";")??undefined)).join(' ').replaceAll("|", ''); // split lines, remove comments, join with spaces
console.log(text);
const data = text.split(' ').map(v => v.trim()).filter(v => v.length>0).map((v) => {
    if (v[0] === 'b') {
        return Number.parseInt(v.slice(1).split(/[+_\-]/g).join(''), 2);
    }
    return Number.parseInt(v, 16);
});
writeFileSync(wpath, Buffer.from(data));
