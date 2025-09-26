let symbs = ["!", "-", "+", "W", "&block;"];
let teamcols = ["#333333", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];

let __unified_queues = [[],[],[],false];

/**
 * @typedef {import("../../../topology/topology.js").TilePosition} TilePosition
 * @typedef {import("../../../topology/topology.js").Topology} Topology
 */

let {updateTile, createBoard, setVolatile, flushUpdates} = (()=>{
    /**
     * updates a tile
     * @param {TilePosition} pos
     * @param {number} team
     * @param {number} val
     * @returns {void}
     */
    function updateTile(pos, team, val) {
        __unified_queues[0].push([pos, team, val]);
    }
    /**
     * reinstantiates the game board
     * @param {Topology} topology
     * @param {number[]} board
     * @param {number[]} teamboard
     * @param {number?} choice overrides the rendering choice when provided, setting it to the given value
     * @returns {void}
     */
    function createBoard(topology, board, teamboard, choice) {
        __unified_queues[1].push([topology, board, teamboard, choice]);
    }
    /**
     * sets the volatile highlight state for a tile
     * @param {TilePosition} pos
     * @param {boolean} value
     * @returns {void}
     */
    function setVolatile(pos, value) {
        __unified_queues[2].push([pos, value]);
    }
    /**
     * flushes updateTile, updateBoard, and setVolatile calls when applicable
     * @returns {void}
     */
    function flushUpdates() {
        __unified_queues[3] = true;
    }
    return { updateTile, createBoard, setVolatile, flushUpdates };
})();
{
    const f = (()=>{
        const dummyFunc = () => {};
        let renderchoice = 0;
        const methods = [[original_updateTile, concentric_updateTile, d3_updateTile], [original_createBoard, concentric_createBoard, d3_createBoard], [original_setVolatile, concentric_setVolatile, d3_setVolatile], [original_cleanup, concentric_cleanup, d3_cleanup], [dummyFunc, dummyFunc, d3_flushUpdates]];
        /**
         * updates a tile
         * @param {TilePosition} pos
         * @param {number} team
         * @param {number} val
         * @returns {void}
         */
        function updateTile(pos, team, val) {
            methods[0][renderchoice](pos, team, val);
        }
        /**
         * reinstantiates the game board
         * @param {Topology} topology
         * @param {number[]} board
         * @param {number[]} teamboard
         * @param {number?} choice overrides the rendering choice when provided, setting it to the given value
         * @returns {void}
         */
        function createBoard(topology, board, teamboard, choice) {
            if ((choice ?? false) !== false) {
                if (choice !== renderchoice) {
                    methods[3][renderchoice]();
                }
                renderchoice = choice;
            }
            methods[1][renderchoice](topology, board, teamboard);
        }
        /**
         * sets the volatile highlight state for a tile
         * @param {TilePosition} pos
         * @param {boolean} value
         * @returns {void}
         */
        function setVolatile(pos, value) {
            methods[2][renderchoice](pos, value);
        }
        /**
         * flushes updateTile, updateBoard, and setVolatile calls when applicable
         * @returns {void}
         */
        function flushUpdates() {
            methods[4][renderchoice]();
        }
        return { updateTile, createBoard, setVolatile, flushUpdates };
    });
    let n = 4;
    for (const name of ["original", "concentric", "3d", "_"]) {
        let s;
        if (name !== "_") {
            s = document.createElement("script");
            s.src = `helpers/render/${name}.js`;
        } else {
            s = document.getElementById("SCRIPT-r3d");
        }
        s.onload = () => {
            n --;
            if (n === 0) {
                const o = f();
                updateTile = o.updateTile;
                createBoard = o.createBoard;
                setVolatile = o.setVolatile;
                flushUpdates = o.flushUpdates;
                for (const l of __unified_queues[1]) {
                    createBoard(...l);
                }
                for (const l of __unified_queues[0]) {
                    updateTile(...l);
                }
                for (const l of __unified_queues[2]) {
                    setVolatile(...l);
                }
                if (__unified_queues[3]) {
                    flushUpdates();
                }
            }
        }
        document.body.appendChild(s);
    }
}

let __runi_board;
let __runi_teamboard;
let __runi_topo;

/**
 * @param {Topology} topo
 * @param {ArrayLike<number>} board
 * @param {ArrayLike<number>} teamboard
 */
function setup(topo, board, teamboard) {
    /**@type {HTMLSelectElement} */
    const bro = document.getElementById("board-rendering-option");
    __runi_topo = topo;
    __runi_board = board;
    __runi_teamboard = teamboard;
    createBoard(topo, board, teamboard, Number(bro.value)-1);
    flushUpdates();
    bro.onchange = () => {
        createBoard(topo, board, teamboard, Number(bro.value)-1);
        flushUpdates();
        document.getElementById("spherical-bloom-enabled").hidden = (bro.value !== "3");
    };
    document.getElementById("spherical-enable-bloom").onchange = () => {
        window.postMessage({type:"3d-setbloom",enabled:document.getElementById("spherical-enable-bloom").checked});
    };
}

/**
 * @param {number[]} oldb
 * @param {number[]} oldt
 */
function updateBoard(oldb, oldt) {
    for (let i = 0,l=__runi_topo.tileCount; i < l; i ++) {
        if ((oldb[i] !== __runi_board[i]) || (oldt[i] !== __runi_teamboard[i])) {
            const p = this.topology.getPositionOf(i, "2d-grid");
            updateTile(p, __runi_teamboard[i], __runi_board[i]);
            setVolatile(p, __runi_board[i] === __runi_topo.getNeighbors(i).length);
        }
    }
    flushUpdates();
}
