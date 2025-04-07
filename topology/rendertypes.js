/**
 * @file
 * rendering modes and position data structures
 * 
 * when interpreting relative locations, such as "front", "left", "top"
 * in 2d, "top" is the top of the screen, "left" is the left of the screen
 * in 3d, "top" is the topmost layer, "left" is the left of the screen, "front" is the tile with the most positive z-coordinate.
 * it is assumed that all 3d cameras are by default in a top-down view, such that "left" is the same between 2d and 3d, and "top" in 2d is equivalent to "back" in 3d
 */

export class InvariantViolationError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvariantViolationError";
    }
}
export class TypeConversionError extends Error {
    /**
     * represents an error caused by an attempt to convert between incompatible types
     * @param {String} message
     */
    constructor (message) {
        super(message);
        this.name = "TypeConversionError";
    }
}

/**
 * @typedef RenderType
 * @type {"any"|"2d-grid"|"3d-grid"|"2d-disk"|"3d-disk"|"3d-sphere"}
 */
/**
 * @typedef RenderRestriction
 * @type {object}
 * @prop {RenderType[]} some all allowed types
 * @prop {RenderType[]} none acts as subtraction from some (eg. {some:["any"],none:["2d-circle"]} specifies all except 2d-circle)
 */

function validateInteger(n) {
    if (isNaN(n) || !Number.isInteger(n)) {
        throw new InvariantViolationError("number must be an integer");
    }
}

export class TP_Cart2D {
    #x;#y;
    /**
     * @param {number} x {@link TP_Cart2D.x}
     * @param {number} y {@link TP_Cart2D.y}
     */
    constructor(x, y) {
        validateInteger(x);
        validateInteger(y);
        this.#x = x;
        this.#y = y;
    }
    /**
     * @type {{
     * (object: TP_Cart2D): TP_Cart2D;
     * (object: TP_Cart3D): TP_Cart2D;
     * (object: [number,number]): TP_Cart2D;
     * (object: {x:number,y:number}): TP_Cart2D;
     * }}
     */
    static from = (object) => {
        if (object instanceof TP_Cart2D) {
            return object;
        }
        if (object instanceof TP_Cart3D) {
            if (object.z === 0) {
                return new TP_Cart2D(object.x, object.y);
            }
            throw new TypeConversionError("cannot convert non-zero z coordinate");
        }
        if (Array.isArray(object)) {
            if (object.length === 2) {
                return new TP_Cart2D(object[0], object[1]);
            }
            throw new TypeConversionError("wrong number of coordinates");
        }
        if (typeof object === "object") {
            const keys = Object.keys(keys);
            if (keys.length !== 2) {
                throw new TypeConversionError("wrong number of coordinates");
            }
            if (!keys.includes("x")) {
                throw new TypeConversionError("missing x coordinate");
            }
            if (!keys.includes("y")) {
                throw new TypeConversionError("missing y coordinate");
            }
            return new TP_Cart2D(object.x, object.y);
        }
        throw new TypeConversionError("unkown type");
    };
    /**
     * in tiles from left
     * @returns {number}
     */
    get x(){return this.#x;}
    /**
     * in tiles from top
     * @returns {number}
     */
    get y(){return this.#y;}
    /**{@link TP_Cart2D.x} */
    get 0(){return this.#x;}
    /**{@link TP_Cart2D.y} */
    get 1(){return this.#y;}
}
export class TP_Cart3D {
    #x;#y;#z;
    /**
     * NOTE: a TP_Grid3D is an extension of a TP_Grid2D, x and y share the same meanings.
     * Semantically, a TP_Grid2D is a TP_Grid3D with the z coordinate restricted to zero
     * @param {number} x {@link TP_Cart3D.x}
     * @param {number} y {@link TP_Cart3D.y}
     * @param {number} z {@link TP_Cart3D.z}
     */
    constructor(x, y, z) {
        validateInteger(x);
        validateInteger(y);
        validateInteger(z);
        this.#x = x;
        this.#y = y;
        this.#z = z;
    }
    /**
     * @type {{
     * (object: TP_Cart3D): TP_Cart3D;
     * (object: TP_Cart2D): TP_Cart3D;
     * (object: [number,number]): TP_Cart3D;
     * (object: [number,number,number]): TP_Cart3D;
     * (object: {x:number,y:number}): TP_Cart3D;
     * (object: {x:number,y:number,z:number}): TP_Cart3D;
     * }}
     */
    static from = (object) => {
        if (object instanceof TP_Cart3D) {
            return object;
        }
        if (object instanceof TP_Cart2D) {
            return new TP_Cart3D(object.x, object.y, 0);
        }
        if (Array.isArray(object)) {
            if (object.length === 2) {
                return new TP_Cart3D(object[0], object[1], 0);
            }
            if (object.length === 3) {
                return new TP_Cart3D(object[0], object[1], object[2]);
            }
            throw new TypeConversionError("wrong number of coordinates");
        }
        if (typeof object === "object") {
            const keys = Object.keys(object);
            if (keys.length < 2 || keys.length > 3) {
                throw new TypeConversionError("wrong number of keys");
            }
            if (!keys.includes("x")) {
                throw new TypeConversionError("missing x coordinate");
            }
            if (!keys.includes("y")) {
                throw new TypeConversionError("missing y coordinate");
            }
            if (keys.length === 3 && !keys.includes("z")) {
                throw new TypeConversionError("missing z coordinate");
            }
            return new TP_Cart3D(object.x, object.y, object.z ?? 0);
        }
        throw new TypeConversionError("unknown type");
    };
    /**
     * in tiles from left
     * @returns {number}
     */
    get x(){return this.#x;}
    /**
     * in tiles from back
     * @returns {number}
     */
    get y(){return this.#y;}
    /**
     * in tiles from bottom
     * @returns {number}
     */
    get z(){return this.#z;}
    /**{@link TP_Cart2D.x} */
    get 0(){return this.#x;}
    /**{@link TP_Cart2D.y} */
    get 1(){return this.#y;}
    /**{@link TP_Cart2D.z} */
    get 2(){return this.#z;}
}

export class TP_Polar2D {
    #theta;#radius;
    /**
     * @param {number} theta {@link TP_Polar2D.theta}
     * @param {number} radius {@link TP_Polar2D.radius}
     */
    constructor(theta, radius) {
        validateInteger(theta);
        validateInteger(radius);
        if (radius < 0) {
            throw new InvariantViolationError("radius must not be negative");
        }
        this.#theta = theta;
        this.#radius = radius;
    }
    /**
     * in discrete arcs of tiles clockwise from the upwards vertical ray
     * @returns {number}
     */
    get theta() {return this.#theta;}
    /**
     * in tiles
     * @returns {number}
     */
    get radius() {return this.#radius;}
    /**{@link TP_Polar2D.theta}*/
    get 0(){return this.#theta;}
    /**{@link TP_Polar2D.radius}*/
    get 1(){return this.#radius;}
}
export class TP_Polar3D {
    #theta;#phi;#radius;
    /**
     * @param {number} theta {@link TP_Polar3D.theta}
     * @param {number} phi {@link TP_Polar3D.phi}
     * @param {number} radius {@link TP_Polar3D.radius}
     */
    constructor(theta, phi, radius) {
        validateInteger(theta);
        validateInteger(phi);
        validateInteger(radius);
        if (radius < 0) {
            throw new InvariantViolationError("radius must not be negative");
        }
        this.#theta = theta;
        this.#phi = phi;
        this.#radius = radius;
    }
    /**
     * in discrete arcs of tiles clockwise from the z-axis ray away from the front
     * @returns {number}
     */
    get theta() {return this.#theta;}
    /**
     * in discrete layers of tiles from the upwards y-axis ray
     * @returns {number}
     */
    get phi() {return this.#phi;}
    /**
     * in tiles
     * @returns {number}
     */
    get radius() {return this.#radius;}
    /**{@link TP_Polar3D.theta}*/
    get 0(){return this.#theta;}
    /**{@link TP_Polar3D.phi}*/
    get 1(){return this.#phi;}
    /**{@link TP_Polar3D.radius}*/
    get 2(){return this.#radius;}
}

/**
 * @typedef TilePosition
 * @type {TP_Cart2D|TP_Cart3D|TP_Polar2D|TP_Polar3D}
 */

export class ValueError extends Error {
    /**
     * represents an error caused by an invalid value
     * @param {String} message
     */
    constructor (message) {
        super(message);
        this.name = "ValueError";
    }
}

// exports.RenderType = this.RenderType;
// exports.RenderRestriction = this.RenderRestriction;
// exports.TilePosition = this.TilePosition;
// exports.TP_Cart2D = TP_Cart2D;
// exports.TP_Cart3D = TP_Cart3D;
// exports.TP_Polar2D = TP_Polar2D;
// exports.TP_Polar3D = TP_Polar3D;
