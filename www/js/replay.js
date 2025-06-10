/**@type {HTMLInputElement} */
const fileSelection = document.getElementById("replay-upload");
/**@type {HTMLDivElement} */
const replayCont = document.getElementById("replay-area");
/**@type {HTMLDivElement} */
const gameBoard = document.getElementById("gameboard");

/**@type {import("../logic/game").Game} */
const game = new Game();

// let symbs = ["!", "-", "+", "W", "█"];
// let symbs = ["!", "-", "+", "W", "&block;"];
// let teamcols = ["#000000", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];

/**
 * @typedef ReplayEvent
 * @type {{type:0,time_delta?:number,player:number}|{type:1,time_delta?:number,move:number[],player?:number}|{type:2,time_delta:number}
 * }
 */

/**
 * @typedef ReplayData
 * @type {{name:string,width:number,height:number,players:number,flags:{timestamp:boolean,size:number,order:boolean},start:number,strategy?:number,team_map?:number[],events:ReplayEvent[]}}
 */

class ConsumableBytes {
    /**
     * @param {Uint8Array} bytes
     */
    constructor(bytes) {
        this._bytes = bytes;
        this._pos = 0;
    }
    /**
     * consumes count bytes
     * @param {number} count
     * @returns {Uint8Array|number}
     */
    consume(count) {
        if (this._pos >= this._bytes.length) throw new Error("DATA ALL GONE");
        if (count === 1) {
            return this._bytes[this._pos++];
        }
        const s = this._bytes.slice(this._pos, this._pos+count);
        this._pos += count;
        return s;
    }
    /**
     * peeks ahead by, and does not consume, count bytes
     * @param {number} count
     * @returns {Uint8Array|number}
     */
    peek(count) {
        if (count === 1) {
            return this._bytes[this._pos];
        }
        return this._bytes.slice(this._pos, this._pos+count);
    }
}

/**@type {ReplayData} */
let replay_data = null;
let replay_pos = 0;
let replay_game = {
    timestamp: 0,
    players: [false]
};
let replay_turn = -1;
/**@type {[number[],number[]]} */
let replay_board = [];

/**
 * @param {number} r
 * @param {number} c
 * @param {number} p
 */
function updateBoard(r, c, p) {
    const t = replay_data.flags.order ? replay_data.team_map[p-1] : p;
    const board = replay_board;
    /**@type {number[]} */
    let q = [c, r];
    let l = {};
    const MAXUPDATE = replay_data.width * replay_data.height;
    // let counter = 0;
    while (q.length > 0) {
        // counter += 1;
        if (Object.keys(l).length >= MAXUPDATE) break;
        // console.log(Object.keys(l));
        // if (counter > 15) throw new Error();
        const cr = q.pop();
        const cc = q.pop();
        const i = cr * replay_data.width + cc;
        board[0][i] += 1;
        board[1][i] = t;
        /**@type {0|4|8} */
        const kr = cr === 0 ? 4 : (cr === replay_data.height-1 ? 8 : 0);
        /**@type {0|1|2} */
        const kc = cc === 0 ? 1 : (cc === replay_data.width-1 ? 2 : 0);
        switch (kc|kr) {
            case 0:
                if (board[0][i] > 4) {
                    board[0][i] = 1;
                    q.push(cc-1, cr, cc, cr-1, cc+1, cr, cc, cr+1);
                }
                break;
            case 1:
            case 2:
            case 4:
            case 8:
                if (board[0][i] > 3) {
                    board[0][i] = 1;
                    switch (kc|kr) {
                        case 1:
                            q.push(cc, cr-1, cc+1, cr, cc, cr+1);
                            break;
                        case 2:
                            q.push(cc-1, cr, cc, cr-1, cc, cr+1);
                            break;
                        case 4:
                            q.push(cc-1, cr, cc+1, cr, cc, cr+1);
                            break;
                        case 8:
                            q.push(cc-1, cr, cc, cr-1, cc+1, cr);
                            break;
                    }
                }
                break;
            default:
                if (board[0][i] > 2) {
                    board[0][i] = 1;
                    if (kr === 4) {
                        q.push(cc, cr+1);
                    } else {
                        q.push(cc, cr-1);
                    }
                    if (kc === 1) {
                        q.push(cc+1, cr);
                    } else {
                        q.push(cc-1, cr);
                    }
                }
                break;
        }
        l[`r${cr}c${cc}`] = board[0][i];
    }
    for (const id in l) {
        const e = document.getElementById(id);
        e.style.color = teamcols[t];
        e.firstElementChild.innerHTML = symbs[l[id]];
    }
}

/**
 * updates a part of the screen to show the given value
 * @param {"info"|"status"|"time"} item what part of the screen to update
 * @param {object} value value to display
 */
function updateScreen(item, value) {
    document.getElementById(item).textContent = value.toString();
}
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
 * @param {Date} t current time
 * @param {number} [d=0] ms since previous time
 * @returns {string}
 */
function formatTime(t, d) {
    d = d || 0;
    const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
    const days = Math.floor(d/D);
    const hours = Math.floor((d%D)/H).toLocaleString("en-US", {minimumIntegerDigits:2});
    const minutes = Math.floor((d%H)/M).toLocaleString("en-US", {minimumIntegerDigits:2});
    const seconds = Math.floor((d%M)/S).toLocaleString("en-US", {minimumIntegerDigits:2});
    const millis = Math.floor(d%S).toLocaleString("en-US", {minimumIntegerDigits:4, useGrouping:false});
    return `${t} (+${days}:${hours}:${minutes}:${seconds}.${millis})`;
}
function formatMove(m) {
    return `${m[0]}x${m[1]}`;
}

async function init_replay() {
    replayCont.hidden = true;
    await new Promise(r => setTimeout(r,0)); // let DOM update
    {
        const cols = replay_data.width;
        const rows = replay_data.height;
        gameBoard.style.cssText = `--ncols:${cols};--nrows:${rows};`;
        await game.setConfig({"type":0,x:cols,y:rows},replay_data.players);
        // let baroa = "";
        // for (let i = 0; i < rows; i++) {
        //     for (let j = 0; j < cols; j++) {
        //         baroa = baroa.concat("<div id=\"r" + i.toString() + "c" + j.toString() + "\"><div>-</div></div>");
        //     }
        // }
        // gameBoard.innerHTML = baroa;
        // if (!render3d) {
        // }
    }
    Display.status = "Before Start";
    Display.turn = "Player 1";
    Display.time = formatTime(new Date(replay_game.timestamp), 0);
    Display.info = `Game ${replay_data.name} (${replay_data.width}x${replay_data.height} & ${replay_data.players})`;
    replayCont.hidden = false;
}
async function replay_step() {
    if (replay_pos >= replay_data.events.length) return; // gaurd against OOB
    const ev = replay_data.events[replay_pos];
    replay_pos ++;
    switch (ev.type) {
        case 0:
            if (replay_data.flags.timestamp) {
                replay_game.timestamp += ev.time_delta;
            }
            replay_game.players[ev.player] = false;
            Display.status = `Player ${ev.player} Removed`;
            break;
        case 1:
            if (replay_data.flags.timestamp) {
                replay_game.timestamp += ev.time_delta;
            }
            if (replay_data.flags.order && replay_data.strategy === 0) {
                replay_turn = ev.player;
            } else {
                if (replay_turn === -1) {
                    replay_turn = 1;
                } else {
                    let i = replay_turn;
                    let c = 0;
                    while (true) {
                        c += 1;
                        // console.log(c);
                        if (c > replay_data.players) {
                            throw new Error();
                        }
                        i = (i + 1) % replay_game.players.length;
                        if (replay_game.players[i]) {
                            replay_turn = i;
                            break;
                        }
                    }
                }
            }
            // updateBoard(ev.move[0], ev.move[1], replay_turn);
            Display.status = `Player ${replay_turn} moved: ${formatMove(ev.move)}`;
            break;
        case 2:
            replay_game.timestamp += ev.time_delta;
            break;
    }
    if (replay_data.flags.timestamp) {
        Display.time = formatTime(new Date(replay_game.timestamp), ev.time_delta);
    }
}

/**
 * @param {number[]} b
 * @returns {number}
 */
function fromBytes(b) {
    let acc = 0n;
    // b.reverse();
    // for (let i = 0; i < b.length; i ++) {
    //     acc |= ((b[i])<<(i*8));
    // }
    for (let i = b.length-1; i >= 0; i --) {
        acc |= BigInt(b[i])<<BigInt(8*(b.length-i-1));
    }
    return Number(acc);
}
/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function cmpLists(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function load_replay() {
    const files = fileSelection.files;
    if (files.length !== 1) return;
    const data = new ConsumableBytes(new Uint8Array(await files[0].arrayBuffer()));
    /**@type {ReplayData} */
    const rdata = {flags:{},events:[]};
    if (data.peek(1) === 0) { // version checks
        alert("replay out of date");
        return;
    }
    if (data.peek(1) > 2) {
        alert("invalid replay version");
        return;
    }
    if (data.consume(1) !== 1) {
        if (data.peek(9)[8] & 0b1111) {
            alert("invalid replay version");
            return;
        }
    }
    rdata.name = [...data.consume(8)].map(v => String.fromCharCode(v)).join(''); // name
    {
        const flags = data.consume(1);
        rdata.flags.timestamp = (flags&0b10000000) !== 0;
        rdata.flags.size = (flags>>5)&3;
        rdata.flags.order = (flags&0b00010000) !== 0;
    } // flags
    rdata.start = fromBytes(data.consume(8)); // start timestamp
    rdata.width = fromBytes(data.consume(2));
    rdata.height = fromBytes(data.consume(2));
    rdata.players = data.consume(1);
    if (rdata.flags.order) {
        rdata.strategy = data.consume(1);
        data.consume(1); // consume padding byte
        rdata.team_map = [];
        for (let i = 0; i < rdata.players; i ++) {
            rdata.team_map.push(data.consume(1));
        }
        if (rdata.players & 1) {
            data.consume(1); // consume padding byte
        }
    }
    while (true) { // find start of events
        // if (data.peek(1) === 0xf0 && data.consume(2)[1] === 0x0f) {
        if (cmpLists(data.consume(2), [0xf0,0x0f])) {
            break;
        }
    }
    while (true) {
        if (cmpLists(data.peek(4), [0xff,0xf0,0x0f,0xff])) {
            break;
        }
        /**@type {ReplayEvent} */
        const ev = {};
        ev.type = data.consume(1);
        switch (ev.type) {
            case 2:
                ev.time_delta = fromBytes(data.consume(3));
                break;
            case 0:
                if (rdata.flags.timestamp) {
                    ev.time_delta = fromBytes(data.consume(2));
                }
                ev.player = data.consume(1);
                break;
            case 1:
                if (rdata.flags.timestamp) {
                    ev.time_delta = fromBytes(data.consume(2));
                }
                if (rdata.flags.order && rdata.strategy === 0 && rdata.flags.size !== 0) {
                    ev.player = data.consume(1);
                }
                switch (rdata.flags.size) {
                    case 0:
                        if (rdata.flags.order && rdata.strategy === 0) {
                            ev.player = (data.peek(1)>>2);
                        }
                        ev.move = [((data.consume(1)&3)<<3)|(data.peek(1)>>5),data.consume(1)&0b11111];
                        break;
                    case 1:
                        ev.move = [data.consume(1), data.consume(1)];
                        break;
                    case 2:
                        ev.move = [(data.consume(1)<<8)|(data.peek(1)>>4),((data.consume(1)&15)<<8)|data.consume(1)];
                        break;
                    case 3:
                        ev.move = [fromBytes(data.consume(2)), fromBytes(data.consume(2))];
                        break;
                }
                break;
        }
        rdata.events.push(ev);
    }
    replay_data = rdata;
    replay_pos = 0;
    replay_turn = -1;
    replay_game.timestamp = replay_data.start;
    replay_game.players = new Array(replay_data.players+1).fill(true, 1, replay_data.players+2);
    replay_game.players[0] = false;
    replay_board = [new Array(replay_data.width*replay_data.height).fill(1), new Array(replay_data.width*replay_data.height).fill(0)];
    init_replay();
}
