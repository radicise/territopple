const topology = new class{
    #m=null;
    set m(v){if(this.#m===null){this.#m=v;}}
    /**@returns {typeof import("../../topology/topology.js")} */
    get m(){return this.#m;}
}();
const loadPromise = new Promise((res,) => {
    import("topology/topology.js").then(r => {topology.m = r;res(r);},r => {throw new Error("could not load topology module");});
});

/**
 * @typedef Player
 * @type {{team:number,ready:boolean}}
 */

class Game {
    constructor() {
        /**@type {string} */
        this.ident = null;
        // /**@type {number} */
        // this.rows = null;
        // /**@type {number} */
        // this.cols = null;
        /**@type {import("../../topology/topology.js").Topology} */
        this.topology = null;
        /**@type {number} */
        this.maxPlayers = null;
        /**@type {number} */
        this.joinedPlayers = 0;
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
        this.hostNum = null;
    }
    /**
     * @param {import("../../topology/topology.js").TopologyParams} params
     * @param {number} players
     */
    async setConfig(params, players) {
        await loadPromise;
        this.topology = topology.m.makeTopology(params);
        // console.log(params);
        // console.log(this.topology);
        // this.rows = height;
        // this.cols = width;
        this.maxPlayers = players;
        // this.joinedPlayers = 0;
        this.spectators = 0;
        const tc = this.topology.tileCount;
        this.owned[0] = tc;
        this.board = new Array(tc).fill(1);
        this.teamboard = new Array(tc).fill(0);
        let playerList = new Array(players+1).fill(null);
        for (let i = 0; i < this.playerList.length; i ++) {
            playerList[i] = this.playerList[i];
        }
        this.playerList = playerList;
        this.playerList[0] = {team:0};
    }
    recalcDerived() {
        this.owned = new Array(6).fill(0);
        for (let i = 0; i < this.teamboard.length; i ++) {
            this.owned[this.teamboard[i]] ++;
        }
    }
    /**
     * @param {number} tile
     * @param {number} team
     */
    move(tile, team) {
        const adds = [tile];
        const tb = this.teamboard;
        const bb = this.board;
        // const w = this.cols;
        // const h = this.rows;
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
            // const c = t%w;
            // const r = (t-c)/w;
            // let mv = 4 - ((c===0||c===w-1)?1:0) - ((r===0||r===h-1)?1:0);
            // if (bb[t] > mv) {
            //     // console.log(`(${r},${c}) ${((c===0||c===w-1)?'':'not ')}H-edge ${((r===0||r===h-1)?'':'not ')}V-edge\nVT:${bb[t]},${tb[t]} MV=${mv}`);
            //     // console.log(t);
            //     // console.log(adds);
            //     bb[t] = 1;
            //     if (c > 0) {
            //         adds.push(t-1);
            //     }
            //     if (c < w-1) {
            //         adds.push(t+1);
            //     }
            //     if (r > 0) {
            //         adds.push(t-w);
            //     }
            //     if (r < h-1) {
            //         adds.push(t+w);
            //     }
            //     // console.log(adds);
            // }
            const neighbors = this.topology.getNeighbors(t);
            if (bb[t] > neighbors.length) {
                bb[t] -= neighbors.length;
                adds.push(...neighbors);
            }
        }
        this.updateBoard(boardold, teamboardold);
    }
    /**
     * @param {number[]} oldb
     * @param {number[]} oldt
     */
    updateBoard(oldb, oldt) {
        // console.log(oldb);
        // console.log(this.board);
        if (false&&render3d) {
            // window.dispatchEvent(new CustomEvent("board-update", {board:this.board,teamboard:this.teamboard,boardold:oldb,teamboardold:oldt}));
        } else {
            for (let i = 0,l=this.topology.tileCount; i < l; i ++) {
                if ((oldb[i] !== this.board[i]) || (oldt[i] !== this.teamboard[i])) {
                    const p = this.topology.getPositionOf(i, "2d-grid");
                    updateTile(p, this.teamboard[i], this.board[i]);
                    setVolatile(p, this.board[i] === this.topology.getNeighbors(i).length);
                }
            }
            // let ct = (this.cols * this.rows) - 1;
            // for (let row = this.rows - 1; row >= 0; row--) {
            //     for (let col = this.cols - 1; col >= 0; col--) {
            //         if ((oldb[ct] != this.board[ct]) || (oldt[ct] != this.teamboard[ct])) {
            //             if (dbg) {
            //                 // console.log("Change of state of tile at r" + row.toString() + "c" + col.toString());
            //             }
            //             updateTile(row, col, this.teamboard[ct], this.board[ct]);
            //         }
            //         ct--;
            //     }
            // }
            // for (let r = 0; r < this.rows; r ++) {
            //     for (let c = 0; c < this.cols; c ++) {
            //         let nm = 4;
            //         if ((c == 0) || (c == (this.cols - 1))) {
            //             nm--;
            //         }
            //         if ((r == 0) || (r == (this.rows - 1))) {
            //             nm--;
            //         }
            //         setVolatile(r, c, this.board[r*this.cols + c] === nm);
            //     }
            // }
            flushUpdates();
        }
    }
}
