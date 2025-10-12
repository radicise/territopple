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
/**@type {typeof import("../../topology/topology.js")} */
let topology;
/**@type {(stream:Uint8Array,context:never)=>PuzzleInfo} */
let parsePuzzle;
/**@type {HTMLSelectElement} */
const varsel = document.getElementById("var-sel");


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

(async () => {
    topology = await import("topology/topology.js");
    parsePuzzle = await getParserFunction("puzzle", "version0");
    puzzleinfo = parsePuzzle(await (await fetch(`/puzs/${puzzle_id}.tpzl`, {method:"GET"})).bytes());
    populatePuzzleInfo();
    // if (urlqueries.has("referred_puzzle")) {}
})();

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
    document.getElementById("var-name").textContent = vari.var_name;
    document.getElementById("var-cps").textContent = vari.CPS;
    document.getElementById("var-movres").textContent = vari.MOV_RESTRICT===0?"Unlimited":vari.MOV_RESTRICT;
    document.getElementById("var-goal").textContent = ["Win","Lose","Force","Reach"][vari.GOAL_ID];
    document.getElementById("var-info").replaceChildren(...replaceNewlines(vari.info_str));
}

