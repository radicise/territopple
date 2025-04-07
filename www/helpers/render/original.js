/**
 * @param {TilePosition} pos
 * @param {number} team
 * @param {number} val
 * @returns {void}
 */
function original_updateTile(pos, team, val) {
    const row = pos.y;
    const col = pos.x;
    let dat = document.getElementById("r" + row.toString() + "c" + col.toString());
    dat.style.color = teamcols[team];
    dat.firstElementChild.innerHTML = symbs[val];
}
/**
 * @param {Topology} topo
 * @param {number[]} board
 * @param {number[]} teamboard
 * @returns {void}
 */
function original_createBoard(topo, board, teamboard) {
    const rows = topo.width;
    const cols = topo.height;
    let baroa = "";
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const ct = i * cols + j;
            baroa = baroa.concat("<div id=\"r" + i.toString() + "c" + j.toString() + `" style="color:${teamcols[teamboard[ct]]}"><div>${symbs[board[ct]]}</div></div>`);
        }
    }
    document.getElementById("gameboard").innerHTML = baroa;
}
/**
 * @param {TilePosition} pos
 * @param {boolean} value
 * @returns {void}
 */
function original_setVolatile(pos, value) {
    const row = pos.y;
    const col = pos.x;
    if (value) {
        document.getElementById(`r${row}c${col}`).classList.add("volatile");
    } else {
        document.getElementById(`r${row}c${col}`).classList.remove("volatile");
    }
}
function original_cleanup() {
    document.getElementById("gameboard").replaceChildren();
}
