/**
 * @typedef Player
 * @type {{team:number}}
 */

class Game {
    constructor() {
        /**@type {string} */
        this.ident = null;
        /**@type {number} */
        this.rows = null;
        /**@type {number} */
        this.cols = null;
        /**@type {number} */
        this.maxPlayers = null;
        /**@type {number} */
        this.joinedPlayers = null;
        /**@type {number} */
        this.spectators = null;
        /**@type {number[]} */
        this.board = null;
        /**@type {number[]} */
        this.teamboard = null;
        this.owned = new Array(6).fill(0);
        /**@type {Player[]} */
        this.playerList = [];
        this.started = false;
        this.hostNum = 0;
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {number} players
     */
    setConfig(width, height, players) {
        this.rows = height;
        this.cols = width;
        this.maxPlayers = players;
        this.joinedPlayers = 0;
        this.spectators = 0;
        this.owned[0] = width*height;
        this.board = new Array(width*height).fill(1);
        this.teamboard = new Array(width*height).fill(0);
        let playerList = new Array(players+1).fill(null);
        for (let i = 0; i < this.playerList.length; i ++) {
            playerList[i] = this.playerList[i];
        }
        this.playerList = playerList;
        this.playerList[0] = {team:0};
    }
    /**
     * @param {number} tile
     * @param {number} team
     */
    move(tile, team) {
        const adds = [tile];
        const tb = this.teamboard;
        const bb = this.board;
        const w = this.cols;
        const h = this.rows;
        const boardold = Array.from(this.board);
        const teamboardold = Array.from(this.teamboard);
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== team) {
                this.owned[tb[t]] --;
                this.owned[team] ++;
                tb[t] = team;
                if (this.owned[team] === bb.length) {
                    break;
                }
            }
            bb[t] ++;
            const c = t%w;
            const r = (t-c)/w;
            let mv = 4 - ((c===0||c===w-1)?1:0) - ((r===0||r===h-1)?1:0);
            if (bb[t] > mv) {
                bb[t] = 1;
                if (c > 0) {
                    adds.push(t-1);
                }
                if (c < w-1) {
                    adds.push(t+1);
                }
                if (r > 0) {
                    adds.push(t-w);
                }
                if (r < h-1) {
                    adds.push(r+w);
                }
            }
        }
        if (render3d) {
            window.dispatchEvent(new Customevent("board-update", {board:this.board,teamboard:this.teamboard,boardold,teamboardold}));
        } else {
            let ct = (cols * rows) - 1;
            for (let row = rows - 1; row >= 0; row--) {
                for (let col = cols - 1; col >= 0; col--) {
                    if ((boardold[ct] != this.board[ct]) || (teamboardold[ct] != this.teamboard[ct])) {
                        if (dbg) {
                            console.log("Change of state of tile at r" + row.toString() + "c" + col.toString());
                        }
                        updateTile(row, col, team, this.board[ct]);
                    }
                    ct--;
                }
            }
            for (let r = 0; r < rows; r ++) {
                for (let c = 0; c < cols; c ++) {
                    let nm = 4;
                    if ((c == 0) || (c == (cols - 1))) {
                        nm--;
                    }
                    if ((r == 0) || (r == (rows - 1))) {
                        nm--;
                    }
                    setVolatile(r, c, this.board[r*cols + c] === nm);
                }
            }
        }
    }
}
