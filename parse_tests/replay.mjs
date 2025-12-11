import {ReplayParser} from "../www/replay/parsers.mjs";
import * as fs from "fs";

const replay = new ReplayParser(fs.readFileSync(process.argv[2]));

console.log(JSON.stringify(replay.header));
while (true) {
    const ev = replay.nextEvent();
    if (ev === null) break;
    console.log(JSON.stringify(ev));
}
