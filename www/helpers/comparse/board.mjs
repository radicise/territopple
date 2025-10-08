// /**@type {typeof import("../topology/topology.js")} */
// const topology = await import("topology/topology.js");
// import { Topology } from "../../topology/topology.js";
import {standaloneBitConsumer} from "./_utils.mjs";

/**
 * @param {Uint8Array} stream
 * @param {{topo:import("../../topology/topology.js").Topology,flags:number}} context
 * @returns {[number[],number[],number]}
 */
export function version0(stream, context) {
    // console.log(context.topo);
    const A = context.flags & 0x80, B = context.flags & 0x40, C = context.flags & 0x20, D = context.flags & 0x10;
    if (A) {throw new Error("ttb-ltr not supp");}
    const bb = new Array(context.topo.tileCount);
    const tb = new Array(context.topo.tileCount);
    const consumebits = standaloneBitConsumer(stream);
    // console.log(consumebits(-1));
    for (let i = 0; i < bb.length; i ++) {
        // console.log(context.topo.getRequiredBits(i));
        bb[i] = consumebits(context.topo.getRequiredBits(i)) + 1;
    }
    // console.log(consumebits(-1));
    let i = 0;
    const M = D ? 7 : 3;
    const N = C ? 11 : 7;
    while (i < tb.length) {
        if (consumebits(1) === 0) {
            tb[i] = consumebits(M);
            i ++;
            continue;
        }
        const t = consumebits(M);
        const c = consumebits(B?4:(consumebits(1)?N:3))+1;
        for (let j = 0; j < c; j ++) {
            tb[i+j] = t;
        }
        i += c;
    }
    const p = consumebits(-1);
    // return [bb, tb, p[0]-(p[1]?0:1)];
    return [bb, tb, p[0]+(p[1]?1:0)];
}
