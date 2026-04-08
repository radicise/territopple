// ORIGINAL IMPLEMENTATION
// class TTConcentricTile extends HTMLElement {
//     static observedAttributes = ["rings", "color"];
//     #value;

//     constructor() {
//         super();
//         this.ready = false;
//         this.#value = 1;
//     }
//     get id() {
//         return this.getAttribute("id");
//     }
//     set id(v) {
//         this.setAttribute("id", v);
//     }
//     get color() {
//         return this.getAttribute("color");
//     }
//     set color(c) {
//         this.setAttribute("color", c);
//         this.style.setProperty("--color", c);
//     }
//     get value() {
//         return this.#value;
//     }
//     set value(v) {
//         this.#value = v;
//         let r = this;
//         for (let i = this.rings; i > 0; i --) {
//             if (i > v) {
//                 r.classList.remove("con-active");
//             } else {
//                 r.classList.add("con-active");
//             }
//             r = r.children[0];
//         }
//     }
//     connectedCallback() {
//         this.ready = true;
//         this.rings = Number(this.getAttribute("rings"));
//         if ((this.rings || 0) < 2) {
//             throw new Error("invalid ring count");
//         }
//         let p = this;
//         for (let i = 1; i < this.rings; i ++) {
//             const r = document.createElement("div");
//             p.appendChild(r);
//             p = r;
//         }
//         let r = this;
//         for (let i = this.rings; i > 0; i --) {
//             if (i > this.#value) {
//                 r.classList.remove("con-active");
//             } else {
//                 r.classList.add("con-active");
//             }
//             r = r.children[0];
//         }
//         this.color = this.color;
//     }
// }
// customElements.define("x-concentric-tile", TTConcentricTile);
// 
// const { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_updateColors, concentric_flushUpdates } = (() => {
//     /**
//      * @param {Topology} topo
//      * @param {number[]} board
//      * @param {number[]} teamboard
//      * @returns {void}
//      */
//     function concentric_createBoard(topo, board, teamboard) {
//         const rows = topo.height;
//         const cols = topo.width;
//         g_rows = rows;
//         g_cols = cols;
//         const gb = document.getElementById("gameboard");
//         gb.replaceChildren();
//         for (let r = 0; r < rows; r ++) {
//             for (let c = 0; c < cols; c ++) {
//                 const ct = r * cols + c;
//                 const u = document.createElement("x-concentric-tile");
//                 const ne = topo.getNeighbors(ct).length;
//                 u.setAttribute("rings", ne);
//                 u.color = teamcols[teamboard[ct]];
//                 u.value = board[ct];
//                 if (board[ct] === ne) {
//                     u.classList.add("volatile");
//                 }
//                 u.id = `r${r}c${c}`;
//                 gb.appendChild(u);
//             }
//         }
//     }
//     /**
//      * @param {TilePosition} pos
//      * @param {number} team
//      * @param {number} val
//      * @returns {void}
//      */
//     function concentric_updateTile(pos, team, val) {
//         const row = pos.y;
//         const col = pos.x;
//         const u = document.getElementById(`r${row}c${col}`);
//         u.color = teamcols[team];
//         u.value = val;
//     }
//     /**
//      * @param {TilePosition} pos
//      * @param {boolean} value
//      * @returns {void}
//      */
//     function concentric_setVolatile(pos, value) {
//         const row = pos.y;
//         const col = pos.x;
//         if (value) {
//             document.getElementById(`r${row}c${col}`).classList.add("volatile");
//         } else {
//             document.getElementById(`r${row}c${col}`).classList.remove("volatile");
//         }
//     }
//     function concentric_cleanup() {
//         document.getElementById("gameboard").replaceChildren();
//     }
//     /**
//      * @param {Topology} topo
//      * @param {number[]} teamboard
//      */
//     function concentric_updateColors(topo, teamboard) {
//         document.getElementById("gameboard").querySelectorAll("x-concentric-tile").forEach(v => {const p = v.id.split("c");const tile = Number(p[0].substring(1))*topo.width+Number(p[1]);v.color=teamcols[teamboard[tile]];});
//     }
//     function concentric_flushUpdates() {}
//     return { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_updateColors, concentric_flushUpdates };
// })();
/**@type {number[]} */
let nb;
const { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_updateColors, concentric_flushUpdates } = (() => {
    /**@type {HTMLCanvasElement} */
    let canvas;
    /**@type {CanvasRenderingContext2D} */
    let context;
    /**@type {number[]} */
    let bb;
    /**@type {number[]} */
    let tb;
    /**@type {number} */
    let rows;
    /**@type {number} */
    let cols;
    /**@type {number} */
    let width;
    /**@type {number} */
    let height;
    /**@type {number} */
    let maxn;
    document.getElementById("gameboard").addEventListener("ds-update", (ev) => {
        console.log(ev.detail.target);
    });
    window.addEventListener("message", (ev) => {
        if (!canvas) return; // message not meant for us
        if (ev.data.type === "3d-resolveclick") {
            /**@type {number} */
            const x = (ev.data.x-canvas.offsetLeft)/canvas.clientWidth * width;
            /**@type {number} */
            const y = (ev.data.y-canvas.offsetTop)/canvas.clientHeight * height;
            const pdim = Math.min(width, height); // smallest dimension
            const size = pdim/Math.max(rows, cols); // smallest tile size needed
            const ti = Math.floor(y/size)*cols + Math.floor(x/size);
            if (ti < 0 || ti >= bb.length) {
                ti = -1;
            }
            window.postMessage({type:"3d-clickresolve",index:ti});
        }
    });
    const alphatweak = 3/5;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} n max neighbors
     * @param {number} v current value
     * @param {number} t owning team
     */
    function drawTile(x, y, n, v, t) {
        const pdim = Math.min(width, height); // smallest dimension
        const size = pdim/Math.max(rows, cols); // smallest tile size needed
        const color = teamcols[t];
        const inc = size/(maxn*2); // ring increment
        context.strokeStyle = "#000000";
        context.fillStyle = "#ffffff";
        context.fillRect(x*size, y*size, size, size); // clear any previous tile
        const colorint = Number.parseInt(color.slice(1), 16);
        const fullcolors = [colorint>>16,(colorint>>8)&0xff,colorint&0xff];
        for (let i = 0; i < n; i ++) {
            const ii = i * inc;
            const s = size-ii*2;
            if ((x < 2 && y === 0) || (x === 1 && y === 1)) {
                console.log(`inc: ${inc}, ii: ${ii}, i: ${i}, size: ${size}, s: ${s}, f: ${v>=n-i}`);
            }
            context.strokeRect(x*size+ii, y*size+ii, s, s);
            if (v >= n-i) {
                const mulv = Math.min((v-n+i+1)*alphatweak,1);
                const vals = [255*(1-mulv) + fullcolors[0]*mulv,255*(1-mulv) + fullcolors[1]*mulv,255*(1-mulv) + fullcolors[2]*mulv];
                context.fillStyle = `#${vals.map(v=>v.toString(16).padStart(2,'0')).join('')}`;
                context.fillRect(x*size+ii, y*size+ii, s, s);
            }
        }
    }
    function renderBoard() {
        context.clearRect(0, 0, width, height);
        for (let r = 0; r < rows; r ++) {
            for (let c = 0; c < cols; c ++) {
                const ct = r * cols + c;
                drawTile(c,r,nb[ct],bb[ct],tb[ct]);
                // const u = document.createElement("x-concentric-tile");
                // const ne = topo.getNeighbors(ct).length;
                // u.setAttribute("rings", ne);
                // u.color = teamcols[teamboard[ct]];
                // u.value = board[ct];
                // if (board[ct] === ne) {
                //     u.classList.add("volatile");
                // }
                // u.id = `r${r}c${c}`;
                // gb.appendChild(u);
            }
        }
    }
    /**
     * @param {Topology} topo
     * @param {number[]} board
     * @param {number[]} teamboard
     * @returns {void}
     */
    function concentric_createBoard(topo, board, teamboard) {
        rows = topo.height;
        cols = topo.width;
        maxn = topo.maxNeighbors;
        const gb = document.getElementById("gameboard");
        canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        gb.replaceChildren(canvas);
        width = canvas.width;
        height = canvas.height;
        context = canvas.getContext("2d",{alpha:false});
        bb = [...board];
        tb = [...teamboard];
        nb = new Array(topo.tileCount).fill(0).map((_,i)=>topo.getNeighbors(i).length);
        renderBoard();
    }
    /**
     * @param {TilePosition} pos
     * @param {number} team
     * @param {number} val
     * @returns {void}
     */
    function concentric_updateTile(pos, team, val) {
        const row = pos.y;
        const col = pos.x;
        const ct = row*cols+col;
        bb[ct] = val;
        tb[ct] = team;
        drawTile(col, row, nb[ct], val, team);
        // const u = document.getElementById(`r${row}c${col}`);
        // u.color = teamcols[team];
        // u.value = val;
    }
    /**
     * @param {TilePosition} pos
     * @param {boolean} value
     * @returns {void}
     */
    function concentric_setVolatile(pos, value) {
        const row = pos.y;
        const col = pos.x;
        // if (value) {
        //     document.getElementById(`r${row}c${col}`).classList.add("volatile");
        // } else {
        //     document.getElementById(`r${row}c${col}`).classList.remove("volatile");
        // }
    }
    function concentric_cleanup() {
        document.getElementById("gameboard").replaceChildren();
        context = null;
        canvas = null;
    }
    /**
     * @param {Topology} topo
     * @param {number[]} teamboard
     */
    function concentric_updateColors(topo, teamboard) {
        // document.getElementById("gameboard").querySelectorAll("x-concentric-tile").forEach(v => {const p = v.id.split("c");const tile = Number(p[0].substring(1))*topo.width+Number(p[1]);v.color=teamcols[teamboard[tile]];});
        renderBoard();
    }
    function concentric_flushUpdates() {
        // renderBoard();
    }
    return { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_updateColors, concentric_flushUpdates };
})();

const concentric_settings = {};
