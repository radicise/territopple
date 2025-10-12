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

(async () => {
    topology = await import("topology/topology.js");
    parsePuzzle = await getParserFunction("puzzle", "version0");
    puzzleinfo = parsePuzzle(await (await fetch(`/puzs/${puzzle_id}.tpzl`, {method:"GET"})).bytes());
    document.getElementById("puzzle-name").textContent = puzzleinfo.name;
    document.getElementById("puzzle-author").textContent = puzzleinfo.author;
    document.getElementById("puzzle-creation").textContent = new Date(puzzleinfo.created).toLocaleString();
    document.getElementById("variant-count").textContent = puzzleinfo.VC;
    document.getElementById("long-description").textContent = puzzleinfo.info_str;
    document.getElementById("player-count").textContent = puzzleinfo.PC;
    document.getElementById("player-teams").replaceChildren(puzzleinfo.TEAMS.map(String).join("\\\n\\").split("\\").map(v => v==="\n"?document.createElement("br"):v));
    document.getElementById("player-order").replaceChildren(puzzleinfo.TURNS.map(String).join("\\\n\\").split("\\").map(v => v==="\n"?document.createElement("br"):v));
    // if (urlqueries.has("referred_puzzle")) {}
})();

