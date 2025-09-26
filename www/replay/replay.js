/**@type {typeof import("../topology/topology.js")} */
const topology = await import("topology/topology.js");
/**@type {typeof import("../../www/replay/parsers.js")} */
const parser = await import("./parsers.js");

/**@type {HTMLInputElement} */
const fileSelection = document.getElementById("replay-upload");
/**@type {HTMLDivElement} */
const replayCont = document.getElementById("replay-area");
/**@type {HTMLDivElement} */
const gameBoard = document.getElementById("gameboard");

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
        owned:null
    };
    /**@type {import("../topology/topology.js").Topology} */
    static topo;
    /**@type {import("../../www/replay/parsers.js").ReplayParser} */
    static parser;
    /**@type {boolean} */
    static broken = false;
    static load_replay() {
        const files = fileSelection.files;
        if (files.length !== 1) return alert("must select a file");
        files[0].arrayBuffer().then(v => {
            try {
                this.parser = new parser.ReplayParser(new Uint8Array(v));
                this.topo = topology.makeTopology(topology.formatDimensions([this.parser.header.topology_id, ...this.parser.header.topology_data.params]));
                this.init_replay();
                this.broken = false;
            } catch (E) {
                alert(E.message);
                console.error(E);
                this.broken = true;
            }
        });
    }
    static init_replay() {
        this.state.board = new Uint8Array(this.topo.tileCount).fill(0);
        this.state.teamboard = new Uint8Array(this.topo.tileCount).fill(0);
        this.state.last_move = -1;
        this.state.turn = -1;
        this.state.timestamp = this.parser.header.start_time;
        this.state.players = new Array(this.parser.header.player_count).fill(true);
        this.state.owned = new Array(6).fill(0);
        this.state.owned[0] = this.topo.tileCount;
        const dims = topology.exportDimensions(this.topo);
        gameBoard.style.cssText = `--ncols:${dims.x};--nrows:${dims.y};`
        setup(this.topo, this.state.board, this.state.teamboard);
        Display.status = "Before Start";
        Display.turn = "Player 1";
        Display.time = parser.formatTime(new Date(this.state.timestamp), 0);
        Display.info = `Game ${this.parser.header.name} (${this.topo.dimensionString} & ${this.parser.header.player_count})`;
        replayCont.hidden = false;
    }
    static step_replay() {
        if (this.broken) {
            return alert("BROKEN FILE");
        }
        const ev = this.parser.nextEvent();
        if (ev === null) {
            alert("End Of File");
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
                this.doMove(this.parser.header.team_table[ev.player], ev.tile);
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
                if (this.owned[team] === bb.length) {
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

// const load_replay = Replayer.load_replay;
// const replay_step = Replayer.step_replay;
window.addEventListener("message", (ev) => {
    if (ev.data.type === "replay-load") {
        Replayer.load_replay();
    } else if (ev.data.type === "replay-step") {
        Replayer.step_replay();
    }
});
