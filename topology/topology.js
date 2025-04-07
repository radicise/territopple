/**
 * @file
 * various board topologies
 * 
 * this is an ES6 module so that it can be loaded by both the client and server to deduplicate code
 */

// const { RenderType, RenderRestriction, TilePosition, TP_Cart2D, TP_Cart3D } = require("./rendertypes.js");
import { TP_Cart2D, TP_Cart3D, ValueError } from "./rendertypes.js";

/**
 * @typedef {import("./rendertypes.js").RenderType} RenderType
 */
/**
 * @typedef {import("./rendertypes.js").RenderRestriction} RenderRestriction
 */
/**
 * @typedef {import("./rendertypes.js").TilePosition} TilePosition
 */

/**
 * base class for board topologies
 */
export class Topology {
    /**
     * @virtual
     * @param {Record<string,number>} dimensions
     */
    constructor(dimensions) {
        this.dimensions = dimensions;
    }
    /**
     * human readable string concisely communicating the dimensions of the topology
     * @virtual
     * @readonly
     * @returns {string}
     */
    get dimensionString() {}
    /**
     * the set of rendering modes that are capable of rendering this topology
     * @virtual
     * @readonly
     * @returns {RenderRestriction}
     */
    get renderRestrictions() {}
    /**
     * maximum neighbors of any tile
     * @virtual
     * @readonly
     * @returns {number}
     */
    get maxNeighbors() {}
    /**
     * number of tiles present
     * @virtual
     * @readonly
     * @returns {number}
     */
    get tileCount() {}
    /**
     * gets position information for rendering the board
     * returns a {@link TilePosition} appropriate for the given rendering mode
     * @virtual
     * @param {number} tindex tile index
     * @param {RenderType} mode rendering mode
     * @returns {TilePosition}
     */
    getPositionOf(tindex, mode) {}
    /**
     * gets the neighbors of a tile
     * @virtual
     * @param {number} tindex tile index
     * @returns {number[]}
     */
    getNeighbors(tindex) {}
    /**
     * gets the required number of bits to store the max value of the given tile
     * @virtual
     * @param {number} tindex
     * @returns {number}
     */
    getRequiredBits(tindex) {}
}

/**
 * 2d grids
 * @inheritdoc
 */
export class TGrid2D extends Topology {
    #bleft;#bright;#tright;
    /**
     * @inheritdoc
     * @param {{width:number,height:number}} dimensions
     */
    constructor(dimensions) {
        super(dimensions);
        this.width = dimensions.width;
        this.height = dimensions.height;
        this.tc = this.width * this.height;
        this.dstr = `Grid2D ${this.width}x${this.height}`;
        this.#tright = this.width - 1;
        this.#bleft = this.width*this.height-this.width - 1;
        this.#bright = this.width*this.height - 1;
    }
    /**
     * @inheritdoc
     * @readonly
     */
    get dimensionString() {
        return this.dstr;
    }
    /**
     * @inheritdoc
     * @readonly
     * @returns {RenderRestriction}
     */
    get renderRestrictions() {
        return {"some":["2d-grid","3d-grid"]};
    }
    /**
     * @inheritdoc
     * @readonly
     */
    get maxNeighbors() {
        return 4;
    }
    /**
     * @inheritdoc
     * @readonly
     */
    get tileCount() {
        return this.tc;
    }
    /**
     * @inheritdoc
     * {@link Topology.getPositionOf}
     * @param {number} tindex
     * @param {RenderType} mode
     * @returns {TilePosition}
     */
    getPositionOf(tindex, mode) {
        switch (mode) {
            case "3d-grid":
            case "2d-grid":
                let x = tindex % this.width;
                return (mode === "2d-grid" ?TP_Cart2D:TP_Cart3D).from([x, (tindex-x)/this.width]);
            default:
                throw new TypeError("GridTopology can only render as 2d or 3d grid");
        }
    }
    /**
     * gets the neighbors of a tile
     * @param {number} tindex tile index
     * @returns {number[]}
     */
    getNeighbors(tindex) {
        const x = tindex % this.width;
        const y = (tindex - x) / this.width;
        const f = [];
        if (x > 0) {
            f.push(tindex-1);
        }
        if (x < this.width-1) {
            f.push(tindex+1);
        }
        if (y > 0) {
            f.push(tindex-this.width);
        }
        if (y < this.height-1) {
            f.push(tindex+this.width);
        }
        return f;
    }
    /**
     * @inheritdoc
     * @param {number} tindex
     * @returns {number}
     */
    getRequiredBits(tindex) {
        if (tindex === 0 || tindex === this.#tright || tindex === this.#bleft || tindex === this.#bright) {
            return 1;
        }
        return 2;
    }
}

/**
 * @typedef TopologyParams
 * @type {{type:0,x:number,y:number}|{type:1,x:number,y:number,z:number}}
 */

/**
 * @param {TopologyParams} params
 * @returns {Topology}
 */
export function makeTopology(params) {
    switch (params.type) {
        case 0:{
            return new TGrid2D({width:params.x,height:params.y});
        }
        default:{
            throw new ValueError("unkown topology type identifier");
        }
    }
}
const tops = [TGrid2D];
/**
 * @param {Topology} topology
 * @returns {number}
 */
export function getTopologyId(topology) {
    for (let i = 0; i < tops.length; i ++) {
        if (topology instanceof tops[i]) {
            return i;
        }
    }
    return -1;
}

/**
 * @param {number[]} dims
 * @returns {Record<string,number>|null}
 */
export function formatDimensions(dims) {
    switch (dims[0]) {
        case 0:{
            return {type:0,x:dims[1],y:dims[2]};
        }
        default:return null;
    }
}

/**
 * @param {Topology} top
 * @returns {Record<string,number>}
 */
export function exportDimensions(top) {
    switch (getTopologyId(top)) {
        case 0:{
            return {x:top.width,y:top.height};
        }
    }
}
