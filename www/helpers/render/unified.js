let symbs = ["!", "-", "+", "W", "&block;"];
let teamcols = ["#333333", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];

let __unified_queues = [[],[],[]];

let {updateTile, createBoard, setVolatile} = (()=>{
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
    return { updateTile, createBoard, setVolatile };
})();
{
    const f = (()=>{
        let renderchoice = 0;
        const methods = [[original_updateTile, concentric_updateTile], [original_createBoard, concentric_createBoard], [original_setVolatile, concentric_setVolatile], [original_cleanup, concentric_cleanup]];
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
        return { updateTile, createBoard, setVolatile };
    });
    let n = 2;
    for (const name of ["original", "concentric"]) {
        const s = document.createElement("script");
        s.src = `helpers/render/${name}.js`;
        s.onload = () => {
            n --;
            if (n === 0) {
                const o = f();
                updateTile = o.updateTile;
                createBoard = o.createBoard;
                setVolatile = o.setVolatile;
                for (const l of __unified_queues[0]) {
                    updateTile(...l);
                }
                for (const l of __unified_queues[1]) {
                    createBoard(...l);
                }
                for (const l of __unified_queues[2]) {
                    setVolatile(...l);
                }
            }
        }
        document.body.appendChild(s);
    }
}
