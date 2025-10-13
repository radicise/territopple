// const topology = new class{
//     #m=null;
//     set m(v){if(this.#m===null){this.#m=v;}}
//     /**@returns {typeof import("../../topology/topology.js")} */
//     get m(){return this.#m;}
// }();
// const loadPromise = new Promise((res,) => {
//     import("topology/topology.js").then(r => {topology.m = r;res(r);},r => {throw new Error("could not load topology module");});
// });
/**@typedef {import("../helpers/comparse/puzzle.mjs").PuzzleInfo} PuzzleInfo */
/**@typedef {import("../helpers/comparse/puzzle.mjs").VariantInfo} VariantInfo */
/**@type {typeof import("../../topology/topology.js")} */
let topology;
/**@type {(stream:Uint8Array,context:never)=>PuzzleInfo} */
let parsePuzzle;
/**@type {HTMLSelectElement} */
const varsel = document.getElementById("var-sel");
varsel.addEventListener("change", () => {curr_variant=Number(varsel.value);populateVariantInfo();});
/**@type {HTMLDivElement} */
const targetSandwichE = document.getElementById("target-sandwich");
/**@type {HTMLDivElement} */
let gameboard;
/**@type {HTMLInputElement} */
let startButton;
/**@type {HTMLInputElement} */
let pingButton;


// everything after "/puzzle/"
const puzzle_id = location.pathname.substring(8);
if (puzzle_id.length === 0) {
    // this page requires a puzzle to work properly
    // no puzzle? no problem, go to the puzzle list to pick one out
    window.location.pathname = "/puzzles";
}
console.log(puzzle_id);

/**@type {PuzzleInfo} */
let puzzleinfo;
let curr_variant = 0;
/**@type {VariantInfo} */
let variantinfo;
let puzzle_started = false;
/**@type {{owned:number[],board:Uint8Array,teamboard:Uint8Array,players:boolean[],turns:number[],turn:number,turnindex:number,last_move:number}} */
let puzzle = null;
/**@type {number[][]} */
let movehist = null;

(async () => {
    await INCLUDE_FINISHED;
    gameboard = document.getElementById("gameboard")
    startButton = document.getElementById("startbutton")
    pingButton = document.getElementById("pingbutton");
    pingButton.disabled = true;
    pingButton.value = "next";
    document.getElementById("turn-time").hidden = true;
    topology = await import("topology/topology.js");
    parsePuzzle = await getParserFunction("puzzle", "version0");
    puzzleinfo = parsePuzzle(await (await fetch(`/puzs/${puzzle_id}.tpzl`, {method:"GET"})).bytes());
    populatePuzzleInfo();
    startButton.addEventListener("click", () => {
        puzzle_started = !puzzle_started;
        if (puzzle_started) {
            variantinfo = puzzleinfo.variants[curr_variant];
            startPuzzle();
            startButton.value = "stop";
            varsel.disabled = true;
        } else {
            stopPuzzle();
            startButton.value = "start";
            varsel.disabled = false;
        }
    });
    pingButton.addEventListener("click", () => {
        if (!puzzle_started) return;
        if (variantinfo.CPS.includes(puzzle.turn)) return;
        doMove(puzzleinfo.TEAMS[puzzle.turn], getNPCMove());
    });
    gameboard.addEventListener("mouseup", (event) => {
        if (event.button !== 0) return;
        if (gameboard.style.getPropertyValue("--disabled") === "1") return;
        if (!puzzle_started) return;
        console.log("click");
        if (event.target?.nodeName === "CANVAS") {
            window.postMessage({type:"3d-resolveclick",x:event.clientX,y:event.clientY});
            return;
        }
        let d = event.target.id;
        if (d.substring(0, 1) != "r") {
            return;
        }
        let mes = d.substring(1);
        mes = mes.split("c");
        if (mes.length != 2) {
            return;
        }
        let meg = parseInt(mes[1]);
        mes = parseInt(mes[0]);
        if (isNaN(mes) || isNaN(meg)) {
            return;
        }
        mes = (mes * topology.exportDimensions(puzzleinfo.topology).x) + meg;
        console.log(mes);
        if ((puzzle.teamboard[mes]) && (puzzle.teamboard[mes] != puzzleinfo.TEAMS[puzzle.turn])) {
            return;
        }
        doMove(mes);
        return;
    });
    window.addEventListener("message", (ev) => {
        switch (ev.data.type) {
            case "3d-clickresolve":{
                const index = ev.data.index;
                if (index === -1) return;
                if (puzzle.teamboard[index] !== puzzleinfo.TEAMS[puzzle.turn] && puzzle.teamboard[index] !== 0) return;
                doMove(index);
                break;
            }
        }
    });
    // if (urlqueries.has("referred_puzzle")) {}
})();

function getNPCMove() {
    const npc = variantinfo.BOTS[puzzle.turn];
    if (variantinfo.TURN_FLAGS & 0x80) {
        const rec = variantinfo.MOVES[puzzle.turn];
        if (rec) {
            const mv = rec[puzzle.turns[puzzle.turn]];
            if (mv) {
                if (mv.relto !== false) {
                    let pid = puzzle.turn - mv.relto;
                    if (pid < 1) {
                        pid += puzzleinfo.PC;
                    }
                    return movehist[pid][puzzle.turns[pid]-mv.tindex-1];
                } else {
                    return mv.tindex;
                }
            }
        }
    }
    if (npc.length === 0) {
        window.alert("broken puzzle");
        throw new Error("no bot, out of moves");
    }
}

function doMove(team, tile) {
    puzzle.last_move = tile;
    const adds = [tile];
    const bb = puzzle.board;
    const tb = puzzle.teamboard;
    const oldb = Uint8Array.from(bb);
    const oldt = Uint8Array.from(tb);
    while (adds.length) {
        const t = adds.pop();
        if (tb[t] !== team) {
            puzzle.owned[tb[t]] --;
            puzzle.owned[team] ++;
            tb[t] = team;
            if (puzzle.owned[team] === bb.length) {
                break;
            }
        }
        bb[t] ++;
        const n = puzzleinfo.topology.getNeighbors(t);
        if (bb[t] > n.length) {
            bb[t] -= n.length;
            adds.push(...n);
        }
    }
    updateBoard(oldb, oldt);
    movehist[puzzle.turn].push(tile);
    puzzle.turns[puzzle.turn] ++;
    while (true) {
        puzzle.turnindex ++;
        puzzle.turnindex %= puzzleinfo.TURNS.length;
        puzzle.turn = puzzleinfo.TURNS[puzzle.turnindex];
        if (!puzzle.players[puzzle.turn]) continue;
        break;
    }
}

function startPuzzle() {
    setup(puzzleinfo.topology, puzzleinfo.initial_board[0], puzzleinfo.initial_board[1]);
    puzzle = {
        owned: new Array(6).fill(0),
        board: Uint8Array.from(puzzleinfo.initial_board[0]),
        teamboard: Uint8Array.from(puzzleinfo.initial_board[1]),
        players: new Array(puzzleinfo.PC+1).fill(true),
        turns: new Array(puzzleinfo.PC+1).fill(1),
        turn: puzzleinfo.TURNS[0],
        turnindex: 0,
        last_move: -1
    };
    puzzle.players[0] = false;
    puzzle.owned[0] = puzzleinfo.topology.tileCount;
    movehist = new Array(puzzleinfo.PC+1).fill(null).map(_ => [-1]);
}
function stopPuzzle() {}

function populatePuzzleInfo() {
    function insertBrs(a) {
        return a.join("\\\n\\").split("\\").map(v => v==="\n"?document.createElement("br"):v);
    }
    document.getElementById("puzzle-name").textContent = puzzleinfo.name;
    document.getElementById("puzzle-author").textContent = puzzleinfo.author;
    document.getElementById("puzzle-creation").textContent = new Date(puzzleinfo.created).toLocaleString();
    document.getElementById("variant-count").textContent = puzzleinfo.VC;
    document.getElementById("long-description").textContent = puzzleinfo.info_str;
    document.getElementById("player-count").textContent = puzzleinfo.PC;
    document.getElementById("player-teams").replaceChildren(...insertBrs(puzzleinfo.TEAMS.map(String)));
    document.getElementById("player-order").replaceChildren(...insertBrs(puzzleinfo.TURNS.map(String)));
    varsel.replaceChildren(...(new Array(puzzleinfo.VC).fill(0)).map((_,i)=>{const n = document.createElement("option");n.value=i;n.textContent=(i+1);return n;}));
    varsel.value = "0";
    populateVariantInfo();
}

function populateVariantInfo() {
    /**
     * @param {string} a
     */
    function replaceNewlines(a) {
        return a.replaceAll("\n", "\\\n\\").split("\\").map(v => v==="\n"?document.createElement("br"):v);
    }
    const vari = puzzleinfo.variants[curr_variant];
    targetSandwichE.hidden = true;
    document.getElementById("var-name").textContent = vari.var_name;
    document.getElementById("var-cps").textContent = vari.CPS;
    document.getElementById("var-movres").textContent = vari.MOV_RESTRICT===0?"Unlimited":vari.MOV_RESTRICT;
    document.getElementById("var-goal").textContent = ["Win","Lose","Force","Reach"][vari.GOAL_ID];
    document.getElementById("var-details").replaceChildren(...replaceNewlines(vari.info_str));
    if (vari.GOAL_ID === 3) {
        populateSandwich(vari.target_state);
    }
}

function populateSandwich(sandwich) {
    const dims = topology.exportDimensions(puzzleinfo.topology);
    targetSandwichE.style.setProperty("--nrows", dims.y);
    targetSandwichE.style.setProperty("--cols", dims.x);
    targetSandwichE.hidden = false;
}
