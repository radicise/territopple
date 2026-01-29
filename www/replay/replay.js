await new Promise(r => {const that = () => {window.removeEventListener("message", that);r();};window.addEventListener("message", that);});
document.getElementById("pingbutton").disabled = true;
document.getElementById("pingbutton").value = "back";
/**@type {typeof import("../topology/topology.js")} */
const topology = await import("topology/topology.js");
/**@type {typeof import("../../www/replay/parsers.mjs")} */
const parser = await import("./parsers.mjs");
const TEAM_COUNT = 7;

/**@type {HTMLInputElement} */
const fileSelection = document.getElementById("replay-upload");
/**@type {HTMLDivElement} */
const replayCont = document.getElementById("replay-area");
/**@type {HTMLDivElement} */
const gameBoard = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const autopp = document.getElementById("startbutton");
autopp.value = "play";

const Display = (()=>{
    /**@type {HTMLParagraphElement} */
    const info = document.getElementById("info");
    /**@type {HTMLHeadingElement} */
    const status = document.getElementById("status");
    /**@type {HTMLParagraphElement} */
    const time = document.getElementById("time");
    /**@type {HTMLParagraphElement} */
    const turn = document.getElementById("turn");
    return {
        get info() {return info.textContent;},
        set info(v) {info.textContent = v.toString();},
        get status() {return status.textContent;},
        set status(v) {status.textContent = v.toString();},
        get time() {return time.textContent;},
        set time(v) {time.textContent = v.toString();},
        get turn() {return turn.textContent;},
        set turn(v) {turn.textContent = v.toString();}
    };
})();

/**
 * @typedef GameState
 * @type {{board:Uint8Array,teamboard:Uint8Array,last_move:number,turn:number,timestamp:number,players:number[],owned:number[],moveno:number,pos:number}}
 */

/**
 * replay logic
 */
class Replayer {
    static state = {
        /**@type {Uint8Array} */
        board:null,
        /**@type {Uint8Array} */
        teamboard:null,
        /**@type {number} */
        last_move:null,
        /**@type {number} */
        turn:null,
        /**@type {number} */
        timestamp:null,
        /**
         * @type {number[]}
         * number is player team
         * 0 is neutral, -1 is eliminated
         */
        players:null,
        /**@type {number[]} */
        owned:null,
        /**@type {number} */
        moveno:null,
        /**@type {number} */
        pos:null,
    };
    /**@type {GameState[]} */
    static state_cache = [];
    /**@type {import("../topology/topology.js").Topology} */
    static topo;
    /**@type {import("../../www/replay/parsers.js").ReplayParser} */
    static parser;
    /**@type {boolean} */
    static broken = false;
    static push_state() {
        this.state_cache.push({board:Uint8Array.from(this.state.board),teamboard:Uint8Array.from(this.state.teamboard),last_move:this.state.last_move,turn:this.state.turn,timestamp:this.state.timestamp,players:Array.from(this.state.players),owned:Array.from(this.state.owned),moveno:this.state.moveno,pos:this.state.pos});
    }
    static load_replay() {
        const files = fileSelection.files;
        if (files.length !== 1) return alert("must select a file");
        files[0].arrayBuffer().then(v => {
            try {
                this.parser = new parser.ReplayParser(new Uint8Array(v));
                this.topo = topology.makeTopology(topology.formatDimensions([this.parser.header.topology_id, ...this.parser.header.topology_data.params]));
                this.init_replay();
                this.broken = false;
                this.done = false;
            } catch (E) {
                alert(E.message);
                console.error(E);
                this.broken = true;
            }
        });
    }
    static init_replay() {
        this.state.board = new Uint8Array(this.topo.tileCount).fill(1);
        this.state.teamboard = new Uint8Array(this.topo.tileCount).fill(0);
        this.state.last_move = -1;
        this.state.turn = -1;
        this.state.timestamp = this.parser.header.start_time;
        this.state.players = new Array(this.parser.header.player_count).fill(true);
        this.state.owned = new Array(TEAM_COUNT).fill(0);
        this.state.owned[0] = this.topo.tileCount;
        this.state.moveno = 0;
        this.state.pos = this.parser.tell();
        const dims = topology.exportDimensions(this.topo);
        gameBoard.style.cssText = `--ncols:${dims.x};--nrows:${dims.y};`
        if (this.parser.header.EXTMETA) {
            {
                const clist = [];
                for (let i = 0; i < 10; i ++) {
                    // const ind = 1668246528|(48+i);
                    const ind = `col${i}`;
                    if (this.parser.header.metatable[ind]) {
                        const cols = this.parser.header.metatable[ind];
                        for (let j = 0; j < cols.length; j += 3) {
                            clist.push(`#${cols.slice(j,j+3).map(v=>v.toString(16).padStart(2,'0')).join('')}`);
                        }
                    }
                }
                setColors(clist, this.topo, this.state.teamboard);
            }
        }
        setup(this.topo, this.state.board, this.state.teamboard);
        Display.status = "Before Start";
        Display.turn = "Player 1";
        Display.time = parser.formatTime(new Date(this.state.timestamp), 0);
        Display.info = `Game ${this.parser.header.name} (${this.topo.dimensionString}, ${this.parser.header.player_count} Players)`;
        replayCont.hidden = false;
        document.getElementById("replay-step").disabled = false;
    }
    static step_replay() {
        if (this.done) return;
        if (this.broken) {
            return alert("BROKEN FILE");
        }
        const ev = this.parser.nextEvent();
        if (ev === null) {
            // alert("End Of File");
            /**@type {HTMLInputElement} */
            const stepbtn = document.getElementById("replay-step");
            stepbtn.disabled = true;
            this.done = true;
            Display.info = "End Of Replay";
            return;
        }
        switch (ev.type) {
            case 0: {
                if (this.parser.header.TIMESTAMP) {
                    this.state.timestamp += ev.time_delta;
                }
                this.state.players[ev.player] = false;
                Display.status = `Player ${ev.player} Eliminated`;
                break;
            }
            case 1: {
                if (this.parser.header.TIMESTAMP) {
                    this.state.timestamp += ev.time_delta;
                }
                if (this.parser.header.ORDER && this.parser.header.order_strategy === 0) {
                    this.state.turn = ev.player;
                } else {
                    alert("Standard Order Not Supported Yet");
                    this.broken = true;
                    return;
                }
                this.state.moveno ++;
                // TODO: implement logic that culls the state cache
                // if (Math.log2(this.state.moveno) >= this.state_cache.length) {
                //     this.push_state();
                // }
                // console.log(ev.player);
                this.doMove(this.parser.header.team_table[ev.player-1], ev.tile);
                Display.turn = ["Neutral","Red","Blue","Magenta","Teal","Yellow"].map((v,i)=>[v,i]).filter(v=>this.state.owned[v[1]]).map(v => `${v[0]}: ${this.state.owned[v[1]]}`).join(", ");
                Display.status = `Player ${this.state.turn} moved: ${this.topo.formatMove(ev.tile)}`;
                break;
            }
            case 2: {
                this.state.timestamp += ev.time_delta;
                break;
            }
        }
        if (this.parser.header.TIMESTAMP) {
            Display.time = parser.formatTime(new Date(this.state.timestamp), ev.time_delta);
        }
    }
    /**
     * @param {number} team
     * @param {number} tile
     */
    static doMove(team, tile) {
        const adds = [tile];
        const bb = this.state.board;
        const tb = this.state.teamboard;
        const oldb = Uint8Array.from(bb);
        const oldt = Uint8Array.from(tb);
        while (adds.length) {
            const t = adds.pop();
            if (tb[t] !== team) {
                this.state.owned[tb[t]] --;
                this.state.owned[team] ++;
                tb[t] = team;
                if (this.state.owned[team] === bb.length) {
                    break;
                }
            }
            bb[t] ++;
            const n = this.topo.getNeighbors(t);
            if (bb[t] > n.length) {
                bb[t] -= n.length;
                adds.push(...n);
            }
        }
        updateBoard(oldb, oldt);
    }
}

let autoplaying = false;
let autoplayintid = 0;
const autoplayinterval = 0.5;
let autoplayspeedS = 1;
/**@type {HTMLInputElement} */
const autoplaySpeed = document.getElementById("autoplay-speed");
autoplaySpeed.addEventListener("change", () => {
    autoplayspeedS = Number(autoplaySpeed.value);
    if (autoplaying) {
        clearTimeout(autoplayintid);
        autoplayintid = setTimeout(autoplay, 1000*autoplayinterval/autoplayspeedS);
    }
});

function autoplay() {
    if (!autoplaying) return;
    if (Replayer.done) {
        autopp.click();
    }
    Replayer.step_replay();
    autoplayintid = setTimeout(autoplay, 1000*autoplayinterval/autoplayspeedS);
}

autopp.addEventListener("click", () => {
    autoplaying = !autoplaying;
    autopp.value = autoplaying ? "pause" : "play";
    document.getElementById("replay-step").disabled = autoplaying;
    if (autoplaying) {
        autoplayintid = setTimeout(autoplay, 1000*autoplayinterval/autoplayspeedS);
    } else {
        clearTimeout(autoplayintid);
    }
});

// const load_replay = Replayer.load_replay;
// const replay_step = Replayer.step_replay;
window.addEventListener("message", (ev) => {
    if (ev.data.type === "replay-load") {
        Replayer.load_replay();
    } else if (ev.data.type === "replay-step") {
        Replayer.step_replay();
    }
    // else if (ev.data.type === "replay-command") {
    //     console.log(eval(ev.data.cmd));
    // }
});
