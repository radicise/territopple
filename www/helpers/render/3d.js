/**
 * @param {number} row
 * @param {number} col
 * @param {number} team
 * @param {number} val
 * @returns {void}
 */
function d3_updateTile(row, col, team, val) {
    // let dat = document.getElementById("r" + row.toString() + "c" + col.toString());
    // dat.style.color = teamcols[team];
    // dat.firstElementChild.innerHTML = symbs[val];
    // window.dispatchEvent(new CustomEvent("3d-updateTile", {row, col, team, val}));
    window.postMessage({"type":"3d-updatetile",row,col,team,val});
}
/**
 * @param {number} rows
 * @param {number} cols
 * @param {number[]} board
 * @param {number[]} teamboard
 * @returns {void}
 */
function d3_createBoard(rows, cols, board, teamboard) {
    // let baroa = "";
    // for (let i = 0; i < rows; i++) {
    //     for (let j = 0; j < cols; j++) {
    //         const ct = i * cols + j;
    //         baroa = baroa.concat("<div id=\"r" + i.toString() + "c" + j.toString() + `" style="color:${teamcols[teamboard[ct]]}"><div>${symbs[board[ct]]}</div></div>`);
    //     }
    // }
    // document.getElementById("gameboard").innerHTML = baroa;
    window.postMessage({"type":"3d-createboard",rows,cols,board,teamboard});
    // window.dispatchEvent(new CustomEvent("3d-createBoard", {rows:rows, cols:cols, board:board, teamboard:teamboard}));
}
/**
 * @param {number} row
 * @param {number} col
 * @param {boolean} value
 * @returns {void}
 */
function d3_setVolatile(row, col, value) {
    // if (value) {
    //     document.getElementById(`r${row}c${col}`).classList.add("volatile");
    // } else {
    //     document.getElementById(`r${row}c${col}`).classList.remove("volatile");
    // }
    // window.dispatchEvent(new CustomEvent("3d-setVolatile"))
}
function d3_cleanup() {
    // document.getElementById("gameboard").replaceChildren();
    // window.dispatchEvent(new CustomEvent("3d-cleanup"));
    window.postMessage({"type":"3d-cleanup"});
}
function d3_flushUpdates() {
    window.postMessage({"type":"3d-flushupdates"});
}
