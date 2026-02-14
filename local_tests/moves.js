const {Game, Player, loadPromise} = require("../defs.js");
const fs = require("fs");
const rl = require("readline");

let g;
loadPromise.then(() => {
    g = new Game("SOMETEST", 2, {topology:{type:0,x:5,y:5},public:false,observable:false});
    g.players.push(new Player(null,1));
    g.players.push(new Player(null,2));
    g.state.turn = 1;
});

function bd() {
    let s = "";
    for (let i = 0; i < g.state.topology.height; i ++) {
        let si = "";
        for (let j = 0; j < g.state.topology.width; j ++) {
            const t = i * 5 + j;
            si += `${g.state.teamboard[t]}${g.state.board[t]} `;
        }
        s += si;
        s += '\n';
    }
    console.log(s);
}

function move(t) {
    const r = g.move(t, g.state.turn, true);
    return r;
}

function vmove(t) {
    const r = move(t);
    bd();
    return r;
}

const int = rl.createInterface(process.stdin,process.stdout);
int.on("line", (l) => {
    switch (l.split(" ")[0].toLowerCase()) {
        case ".stop":{process.exit(0);}
        case ".ld":{fs.readFileSync(l.split(" ")[1],"ascii").trim().split("\n").forEach(v => int.emit("line", v));break;}
        case ".c":{
            try {
                console.log(eval(l.split(" ")[1]));
            } catch (E) {
                console.log(E);
            }
            break;
        }
        default: {
            console.log(vmove(Number(l)));
            break;
        }
    }
});
