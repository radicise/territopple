class TTConcentricTile extends HTMLElement {
    static observedAttributes = ["rings", "color"];
    #value;

    constructor() {
        super();
        this.ready = false;
        this.#value = 1;
    }
    get id() {
        return this.getAttribute("id");
    }
    set id(v) {
        this.setAttribute("id", v);
    }
    get color() {
        return this.getAttribute("color");
    }
    set color(c) {
        this.setAttribute("color", c);
        this.style.setProperty("--color", c);
    }
    get value() {
        return this.#value;
    }
    set value(v) {
        this.#value = v;
        let r = this;
        for (let i = this.rings; i > 0; i --) {
            if (i > v) {
                r.classList.remove("con-active");
            } else {
                r.classList.add("con-active");
            }
            r = r.children[0];
        }
    }
    connectedCallback() {
        this.ready = true;
        this.rings = Number(this.getAttribute("rings"));
        if ((this.rings || 0) < 2) {
            throw new Error("invalid ring count");
        }
        let p = this;
        for (let i = 1; i < this.rings; i ++) {
            const r = document.createElement("div");
            p.appendChild(r);
            p = r;
        }
        let r = this;
        for (let i = this.rings; i > 0; i --) {
            if (i > this.#value) {
                r.classList.remove("con-active");
            } else {
                r.classList.add("con-active");
            }
            r = r.children[0];
        }
        this.color = this.color;
    }
}
customElements.define("x-concentric-tile", TTConcentricTile);

const { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_settings } = (() => {
    const NS = "http://www.w3.org/2000/svg";
    /**@type {SVGSVGElement} */
    const SVG = document.createElementNS(NS, "svg");
    SVG.setAttribute("xmlns", NS);
    SVG.setAttribute("version", "1.1");
    SVG.setAttribute("viewBox", "0 0 100 100");
    SVG.setAttribute("width", "100");
    SVG.setAttribute("height", "100");
    const defs = document.createElementNS(NS, "defs");
    let over_fill = "transparent";
    let stroke_color = "black";
    let stroke_width = "0.25";
    let c_fill_tweak = "aa";
    function updateDefs() {
        for (let i = 3; i >= 0; i --) {
            /**@type {SVGGElement} */
            const g = defs.children[i];
            for (let j = 0; j < (3-i); j ++) {
                /**@type {SVGRectElement} */
                const r = g.children[j];
                r.setAttribute("fill", over_fill);
            }
            for (let j = 0; j < 4; j ++) {
                /**@type {SVGRectElement} */
                const r = g.children[j];
                r.setAttribute("stroke", stroke_color);
                r.setAttribute("stroke-width", stroke_width);
            }
        }
        for (let i = 0; i < 2; i ++) {
            /**@type {SVGGElement} */
            const g = defs.children[i+4];
            for (let j = 0; j < 2; j ++) {
                /**@type {SVGRectElement} */
                const r = g.children[j];
                if (j === 0 && i === 0) {
                    r.setAttribute("fill", over_fill);
                }
                r.setAttribute("stroke", stroke_color);
                r.setAttribute("stroke-width", stroke_width);
            }
        }
        for (let i = 0; i < 3; i ++) {
            /**@type {SVGGElement} */
            const g = defs.children[i+6];
            for (let j = 0; j < 3; j ++) {
                /**@type {SVGRectElement} */
                const r = g.children[j];
                if (j < (2-i)) {
                    r.setAttribute("fill", over_fill);
                }
                r.setAttribute("stroke", stroke_color);
                r.setAttribute("stroke-width", stroke_width);
            }
        }
    }
    defs.innerHTML = `<g id="fill-one-four">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-two-four">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-three-four">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-four-four">
            <rect width="10" height="10" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-one-two">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-two-two">
            <rect width="10" height="10" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-one-three">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-two-three">
            <rect width="10" height="10" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>
        <g id="fill-three-three">
            <rect width="10" height="10" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="${over_fill}" stroke="${stroke_color}" stroke-width="${stroke_width}" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="${stroke_color}" stroke-width="${stroke_width}" />
        </g>`;
    SVG.appendChild(defs);
    let x = ["one", "two", "three", "four"];
    let g_rows = 0;
    let g_cols = 0;
    const concentric_settings = {
        get over_fill(){return over_fill},
        get stroke_color(){return stroke_color},
        get stroke_width(){return stroke_width},
        get c_fill_tweak(){return c_fill_tweak},
        set over_fill(v){
            over_fill = v;
            updateDefs();
        },
        set stroke_color(v){
            stroke_color = v;
            updateDefs();
        },
        set stroke_width(v){
            stroke_width = v;
            updateDefs();
        },
        set c_fill_tweak(v){
            c_fill_tweak = v;
            SVG.style.setProperty("--alpha-tweak", Number.parseInt(v, 16)/255);
            // if (!SVG.parentElement) return;
            // for (let r = 0; r < g_rows; r ++) {
            //     for (let c = 0; c < g_cols; c ++) {
            //         /**@type {SVGUseElement} */
            //         const u = document.getElementById(`r${r}c${c}`);
            //         let f = u.getAttribute("fill");
            //         f = f.slice(0, f.length-2);
            //         u.setAttribute("fill", f + c_fill_tweak);
            //     }
            // }
        }
    };
    concentric_settings.c_fill_tweak = 'aa';
    /**
     * @param {number} r
     * @param {number} c
     * @param {number[]} board
     */
    function getFill(r, c, board) {
        let mv = 4;
        if (r === 0 || r === g_rows - 1) mv --;
        if (c === 0 || c === g_cols - 1) mv --;
        const v = typeof board === "number" ? board : board[r*g_cols + c];
        // return `${x[3-(mv - v)]}-${['two','three','four'][mv-2]}`;
        return `${x[v-1]}-${['two','three','four'][mv-2]}`;
    }
    /**
     * @param {Topology} topo
     * @param {number[]} board
     * @param {number[]} teamboard
     * @returns {void}
     */
    function concentric_createBoard(topo, board, teamboard) {
        // if (!(topo instanceof topology.m.TGrid2D)) {
        //     throw new Error("wrong topology");
        // }
        const rows = topo.height;
        const cols = topo.width;
        g_rows = rows;
        g_cols = cols;
        const gb = document.getElementById("gameboard");
        for (let r = 0; r < rows; r ++) {
            for (let c = 0; c < cols; c ++) {
                const ct = r * cols + c;
                const u = document.createElement("x-concentric-tile");
                const ne = topo.getNeighbors(ct).length;
                u.setAttribute("rings", ne);
                u.color = teamcols[teamboard[ct]];
                u.value = board[ct];
                if (board[ct] === ne) {
                    u.classList.add("volatile");
                }
                u.id = `r${r}c${c}`;
                gb.appendChild(u);
                // const u = document.createElementNS(NS, "use");
                // u.setAttribute("href", `#fill-${getFill(r, c, board)}`);
                // // u.setAttribute("fill", teamcols[teamboard[ct]]+c_fill_tweak);
                // u.style.setProperty("--color", teamcols[teamboard[ct]]);
                // u.setAttribute("x", c * 10);
                // u.setAttribute("y", r * 10);
                // u.id = `r${r}c${c}`;
                // SVG.appendChild(u);
            }
        }
        // SVG.setAttribute("width", cols * 10);
        // SVG.setAttribute("height", rows * 10);
        // SVG.setAttribute("viewBox", `0 0 ${cols*10} ${rows*10}`);
        // document.getElementById("gameboard").appendChild(SVG);
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
        /**@type {SVGUseElement} */
        const u = document.getElementById(`r${row}c${col}`);
        u.color = teamcols[team];
        u.value = val;
        // u.setAttribute("fill", teamcols[team]+c_fill_tweak);
        // u.style.setProperty("--color", teamcols[team]);
        // u.setAttribute("href", `#fill-${x[val-1]}`);
        // u.setAttribute("href", `#fill-${getFill(row, col, val)}`);
    }
    /**
     * @param {TilePosition} pos
     * @param {boolean} value
     * @returns {void}
     */
    function concentric_setVolatile(pos, value) {
        const row = pos.y;
        const col = pos.x;
        if (value) {
            document.getElementById(`r${row}c${col}`).classList.add("volatile");
        } else {
            document.getElementById(`r${row}c${col}`).classList.remove("volatile");
        }
    }
    function concentric_cleanup() {
        document.getElementById("gameboard").replaceChildren();
        SVG.replaceChildren(defs);
    }
    return { concentric_updateTile, concentric_createBoard, concentric_setVolatile, concentric_cleanup, concentric_settings };
})();
