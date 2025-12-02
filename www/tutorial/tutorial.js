
/**@type {HTMLDivElement} */
const messageArea = document.getElementById("message-area");

const sequence = [
    // board setup
    {m:[0,0,1],w:true},
    {m:[0,0,1],w:true},
    {m:[0,2,1],w:true},
    {m:[0,3,2],w:true},
    {m:[0,4,2],w:true},
    // actual tutorial
    {t:"Welcome to the tutorial!\nHere you will learn the basics of how Territopple is played."},
    {t:"This tutorial is still actively being developed. If you have any feedback or suggestions, please send them to feedback@territopple.net!"},
    {t:"Please note that this tutorial only covers the TGrid2D topology (the most commonly used).\nWe urge you to keep in mind that other topologies may not have edges or corners!"},
    {t:"Whenever the next button is grayed out, look for something flashing green, and click it."},
    {t:"These are the display settings.\nClick the button highlighted in green to show them.",h:"#settings-expand-label",w:{c:"#settings-expand-label"}},
    {t:"You can use the board zoom if you have trouble seeing the individual tiles.",h:"#board-zoom"},
    {t:"Here you can change the colors of and disable the various highlights. Pick options that make things visible without cluttering your view.\nThe highlight options you pick will be saved in your browser, so you don't have to fiddle with them every time you start a new game.",h:["#hover-color","#last-move-color","#volatiles-color"]},
    {t:"Last, and most importantly, is the Board Rendering Option. This allows you to choose a different way of viewing the board, which can make things easier to understand.\nWe highly recommend that new players choose the Concentric option.\nGo ahead and try changing the rendering mode!",h:"#board-rendering-option"},
    {t:"Now, we will introduce the board.",h:"#gameboard"},
    {t:"Territopple is played on a board of tiles, each tile has some number of pieces on it.\nThis tile has 1 piece.",h:"#r0c0"},
    {t:"And this one has 2 pieces.",h:"#r0c4"},
    {t:"Additionally, every tile is owned by at most one team.\nAll the black/gray tiles are unowned."},
    {t:"Players take turns placing pieces onto the board.\nYou can only put pieces on tiles that are either owned by your team or not owned by any team."},
    {t:"Try placing a piece here.",h:"#r0c2",w:{c:"#r0c2"}},
    {m:[0,2,1],w:true},
    {t:"When a tile has more pieces on it than it has neighbors (corners have two, edges three, centers four), it topples.\nWhen a tile topples, it gives one of its pieces to each of its neighbors.\nThis will also claim these tiles for your team.",h:"#r0c4"},
    {t:"Put a piece here.",h:["#r0c3","#r1c4"],w:{c:"#r0c4"}},
    {m:[0,4,2],h:["#r0c3","#r0c4","#r1c4"]},
    {t:"When a tile has exactly as many pieces on it as it has neighbors, it's called a Volatile (because it's ready to topple).\nWhen tiles topple onto Volatiles, the Volatiles also topple.\nAdjacent Volatiles form Volatile chains."},
    {t:"Here's one, go ahead and set it off.",h:["#r0c2","#r0c3"],w:{c:"#r0c2"}},
    {m:[0,2,1],w:true},
    {t:"Nice! That covers most of the basics, but here are a couple other things you should know about."},
    {t:"Teams are eliminated when they have no valid moves (eg. they own no tiles and all tiles are claimed).\nYou win when you are the only team remaining."},
    {t:"This is the ping button, it pings the active player. In a real game, you can also ping specific players through the Joined List on the right hand side of the screen.",h:"#pingbutton"},
    {t:"This is the start button, it starts the game, but it won't do anything if you aren't the host.",h:"#startbutton"},
    {t:"This is your remaining time, this is for the Turn Timer rules, in a real game, you can see all players' remaining time via the Joined List on the right hand side of the screen.",h:"#turn-time"},
    {t:"Finally, if you'd like more information about all the rendering modes, please check out the Reference."},
    {t:"Okay, that's all, enjoy playing Territopple!",w:{c:"#home-link"}}
];

const info = {
    board: new Array(25).fill(1),
    teamboard: new Array(25).fill(0),
    owned: [25,0,0],
    last_move: -1
};

(async () => {
    await INCLUDE_FINISHED;
    /**@type {HTMLInputElement} */
    const nextButton = document.getElementById("tutorial-next");
    // this is done to reduce complexity of click detection
    document.getElementById("board-rendering-option").children[2].disabled = true;
    gameboard = document.getElementById("gameboard");
    startButton = document.getElementById("startbutton");
    pingButton = document.getElementById("pingbutton");
    pingButton.disabled = true;
    startButton.disabled = true;
    // document.getElementById("turn-time").hidden = true;
    topology = await import("topology/topology.js");
    info.topology = topology.makeTopology({"type":0,"x":5,"y":5});
    setup(info.topology, info.board, info.teamboard);
    let seqInd = 0;
    let continuePromise = Promise.resolve();
    async function executeItem(item) {
        if (item.t) {
            const p = document.createElement("p");
            p.textContent = item.t;
            messageArea.appendChild(p);
            p.scrollIntoView({"behavior":"smooth"});
            // messageArea.scrollBy({"behavior":"smooth","top":p.clientHeight*2});
        }
        if (item.m) {
            doMove(item.m[2], item.m[0]*5+item.m[1]);
        }
        document.querySelectorAll(".highlight").forEach(v => v.classList.remove("highlight"));
        document.querySelectorAll(".click-here").forEach(v => v.classList.remove("click-here"));
        await new Promise(r => {setTimeout(r, 0)});
        if (item.h) {
            if (typeof item.h === "string") {
                item.h = [item.h];
            }
            item.h.forEach(v => document.querySelector(v).classList.add("highlight"));
        }
        if (!item.w) {
            item.w = {c:"#tutorial-next"};
            nextButton.disabled = false;
        }
        if (item.w === true) {
            continuePromise = Promise.resolve();
        } else {
            if (item.w.c) {
                continuePromise = new Promise(r => {
                    const that = () => {
                        if (nextButton.disabled) {
                            document.querySelector(item.w.c).classList.remove("highlight","click-here");
                        }
                        document.querySelector(item.w.c).removeEventListener("click", that);
                        r();
                    };
                    const e = document.querySelector(item.w.c);
                    e.addEventListener("click", that);
                    if (nextButton.disabled) {
                        e.classList.add("highlight","click-here");
                    }
                });
            }
        }
    }
    while (seqInd < sequence.length) {
        await continuePromise;
        nextButton.disabled = true;
        await executeItem(sequence[seqInd]);
        seqInd ++;
    }
    nextButton.disabled = true;
})();

function doMove(team, tile) {
    info.last_move = tile;
    const adds = [tile];
    const bb = info.board;
    const tb = info.teamboard;
    const oldb = Uint8Array.from(bb);
    const oldt = Uint8Array.from(tb);
    while (adds.length) {
        const t = adds.pop();
        if (tb[t] !== team) {
            info.owned[tb[t]] --;
            info.owned[team] ++;
            tb[t] = team;
            if (info.owned[team] === bb.length) {
                break;
            }
        }
        bb[t] ++;
        const n = info.topology.getNeighbors(t);
        if (bb[t] > n.length) {
            bb[t] -= n.length;
            adds.push(...n);
        }
    }
    updateBoard(oldb, oldt);
}
