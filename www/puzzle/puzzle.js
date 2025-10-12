// const topology = new class{
//     #m=null;
//     set m(v){if(this.#m===null){this.#m=v;}}
//     /**@returns {typeof import("../../topology/topology.js")} */
//     get m(){return this.#m;}
// }();
// const loadPromise = new Promise((res,) => {
//     import("topology/topology.js").then(r => {topology.m = r;res(r);},r => {throw new Error("could not load topology module");});
// });
/**@type {typeof import("../../topology/topology.js")} */
let topology;
/**@type {(stream:Uint8Array,context:never)=>import("../helpers/comparse/puzzle.mjs").PuzzleInfo} */
let parsePuzzle;


// everything after "/puzzle/"
const puzzle_id = location.pathname.substring(8);
if (puzzle_id.length === 0) {
    // this page requires a puzzle to work properly
    // no puzzle? no problem, go to the puzzle list to pick one out
    window.location.pathname = "/puzzles";
}
console.log(puzzle_id);

(async () => {
    topology = await import("topology/topology.js");
    parsePuzzle = await getParserFunction("puzzle", "version0");
    // if (urlqueries.has("referred_puzzle")) {}
})();

