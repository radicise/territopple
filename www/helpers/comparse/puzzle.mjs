import { ConsumableBytes, topology, consumeNStr, readNByteNum } from "./_utils.mjs";
import { version0 as boardv0 } from "./board.mjs";

/**
 * @typedef {{CPC:number,CPS:number[],MOV_RESTRICT:number,GOAL_ID:number,ORDER:number[],target_state:[number[],number[]],TURN_FLAGS:number,BOTS:string[],MC:number,MOVES:Record<number,{id:number,turn_no:number,tindex:number,relto:number|false}>[],info_str:string,var_name:string,HC:number,hints:{text:string,turn_no:number,pnum:number,tindex:number}[]}} VariantInfo
 */

/**
 * @typedef {{
 * version:number,
 * name:string,
 * author:string,
 * created:number,
 * topology_rules:{file:string,id:number,topo:never},
 * topology:import("../../topology/topology").Topology,
 * TPC:number,
 * TPARAMS:number[],
 * PC:number,
 * TEAMS:number[],
 * TURNS:number[],
 * initial_board:[number[],number[]],
 * info_str:string,
 * VC:number,
 * variants:VariantInfo[]
 * }} PuzzleInfo
 */

/**
 * @param {Uint8Array} stream
 * @param {{}} context
 * @returns {PuzzleInfo}
 */
export function version0(stream, context) {
    const buf = new ConsumableBytes(stream);
    const puzzle = {};
    puzzle.version = buf.consume(1);
    if (puzzle.version !== 0) {
        throw new Error("incorrect version");
    }
    puzzle.name = consumeNStr(buf, 1);
    puzzle.author = consumeNStr(buf, 1);
    puzzle.created = readNByteNum(buf, 8);
    puzzle.topology_rules = {file:consumeNStr(buf, 1)};
    if (puzzle.topology_rules.file.length === 0) {
        puzzle.topology_rules.id = buf.consume(1);
        if (puzzle.topology_rules.id === 255) {
            throw new Error("topology rules parser not implemented yet");
        }
    }
    puzzle.TPC = buf.consume(1);
    puzzle.TPARAMS = [...new Array(puzzle.TPC)].map(() => readNByteNum(buf, 2));
    // console.log(puzzle);
    if (puzzle.topology_rules.file.length === 0) {
        if (puzzle.topology_rules.id !== 255) {
            puzzle.topology = topology.makeTopology(topology.formatDimensions([puzzle.topology_rules.id, ...puzzle.TPARAMS]));
        }
    }
    puzzle.PC = buf.consume(1);
    puzzle.TEAMS = [...new Array(puzzle.PC)].map(() => buf.consume(1));
    puzzle.TURNS = [...new Array(puzzle.PC)].map(() => buf.consume(1));
    puzzle.initial_board = boardv0(stream.slice(buf._pos+1), {flags:buf.consume(1),topo:puzzle.topology});
    buf._pos += puzzle.initial_board[2];
    // console.log(`${buf._pos-puzzle.initial_board[2]}->${buf._pos}`);
    // console.log(buf._bytes.slice(buf._pos-puzzle.initial_board[2], buf._pos));
    puzzle.info_str = consumeNStr(buf, 3);
    puzzle.VC = buf.consume(1);
    puzzle.variants = [];
    for (let i = 0; i < puzzle.VC; i ++) {
        const v = {};
        v.CPC = buf.consume(1);
        v.CPS = [...new Array(v.CPC)].map(() => buf.consume(1));
        v.MOV_RESTRICT = buf.consume(1);
        v.GOAL_ID = buf.consume(1);
        switch (v.GOAL_ID) {
            case 2:{v.ORDER = [...new Array(puzzle.PC)].map(() => buf.consume(1));break;}
            case 3:{v.target_state = boardv0(stream.slice(buf._pos+1), {flags:buf.consume(1),topo:puzzle.topology});buf._pos += v.target_state[2];break;}
            default:break;
        }
        v.TURN_FLAGS = buf.consume(1);
        v.BOTS = [];
        for (let j = 0; j < puzzle.PC; j ++) {
            if (v.CPS.includes(j)) {v.BOTS[j] = null;continue;}
            v.BOTS[j] = consumeNStr(buf, 1);
        }
        // console.log(v);
        if (v.TURN_FLAGS & 0x80) {
            v.MC = readNByteNum(buf, 2);
            // console.log(v.MC);
            v.MOVES = new Array(puzzle.PC+1).fill(null);
            const MOVES = [];
            for (let j = 0; j < v.MC; j ++) {
                const move = {id:buf.consume(1),turn_no:buf.consume(1),tindex:readNByteNum(buf, 2),relto:false};
                v.MOVES[move.id] = {};
                if (move.turn_no === 0) {
                    move.relto = -(move.tindex&0x0f);
                    move.turn_no = move.tindex>>8;
                    move.tindex = -(move.tindex&0xf0);
                }
                MOVES[j] = move;
            }
            for (const move of MOVES) {
                v.MOVES[move.id][move.turn_no] = move;
            }
        }
        // console.log(v);
        // console.log(buf._bytes.slice(buf._pos));
        // console.log(readNByteNum(buf, 2));
        // buf._pos -= 2;
        v.info_str = consumeNStr(buf, 2);
        v.var_name = consumeNStr(buf, 1);
        if (v.var_name.length === 0) {
            v.var_name = "Standard";
        }
        v.HC = buf.consume(1);
        v.hints = [];
        for (let j = 0; j < v.HC; j ++) {
            v.hints[j] = {text:consumeNStr(buf, 2)};
            if (v.hints[j].text.length === 0) {
                v.hints[j].pnum = buf.consume(1);
                v.hints[j].turn_no = buf.consume(1);
                v.hints[j].tindex = readNByteNum(buf, 2);
            }
        }
        puzzle.variants.push(v);
    }
    return puzzle;
}
