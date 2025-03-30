let symbs = ["!", "-", "+", "W", "&block;"];
let teamcols = ["#333333", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];

let __unified_queues = [[],[],[],false];

let {updateTile, createBoard, setVolatile, flushUpdates} = (()=>{
    /**
     * updates a tile
     * @param {number} row
     * @param {number} col
     * @param {number} team
     * @param {number} val
     * @returns {void}
     */
    function updateTile(row, col, team, val) {
        __unified_queues[0].push([row, col, team, val]);
    }
    /**
     * reinstantiates the game board
     * @param {number} rows
     * @param {number} cols
     * @param {number[]} board
     * @param {number[]} teamboard
     * @param {number?} choice overrides the rendering choice when provided, setting it to the given value
     * @returns {void}
     */
    function createBoard(rows, cols, board, teamboard, choice) {
        __unified_queues[1].push([rows, cols, board, teamboard, choice]);
    }
    /**
     * sets the volatile highlight state for a tile
     * @param {number} row
     * @param {number} col
     * @param {boolean} value
     * @returns {void}
     */
    function setVolatile(row, col, value) {
        __unified_queues[2].push([row, col, value]);
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
         * @param {number} row
         * @param {number} col
         * @param {number} team
         * @param {number} val
         * @returns {void}
         */
        function updateTile(row, col, team, val) {
            methods[0][renderchoice](row, col, team, val);
        }
        /**
         * reinstantiates the game board
         * @param {number} rows
         * @param {number} cols
         * @param {number[]} board
         * @param {number[]} teamboard
         * @param {number?} choice overrides the rendering choice when provided, setting it to the given value
         * @returns {void}
         */
        function createBoard(rows, cols, board, teamboard, choice) {
            if ((choice ?? false) !== false) {
                if (choice !== renderchoice) {
                    methods[3][renderchoice]();
                }
                renderchoice = choice;
            }
            methods[1][renderchoice](rows, cols, board, teamboard);
        }
        /**
         * sets the volatile highlight state for a tile
         * @param {number} row
         * @param {number} col
         * @param {boolean} value
         * @returns {void}
         */
        function setVolatile(row, col, value) {
            methods[2][renderchoice](row, col, value);
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
