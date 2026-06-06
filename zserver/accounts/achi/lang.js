/**
 * @file
 * this file provides interpretation and execution of achievement code
 */

const { Achievement } = require("./types.js");
const { AccountRecord } = require("../types.js");

/**
 * @typedef AchiCodeFault
 * @type {object}
 * @prop {number} position
 * @prop {string} message
 */

/**
 * @typedef AchiCodeResult
 * @type {null|number|string|Array<number|string>|{value:null,err:AchiCodeFault}}
 */

/**
 * @param {Buffer} code
 * @param {AccountRecord} account
 * @param {Achievement} achidata
 * @returns {Promise<{value:null,err:AchiCodeFault}|{value:any,err:null}>}
 */
async function executeAchiCode(code, account, achidata) {
    let i = 0;
    let position = 0;
    const tmpdomain = {};
    /**
     * @param {boolean} numonly
     * @returns {number|string}
     */
    const getKey = (numonly) => {
        if (numonly) {
            return code[i++];
        }
        const l = code[i++];
        if (l === 0) {
            return code[i++];
        }
        const s = code.subarray(i, i+l).toString("utf8");
        i += l;
        return s;
    };
    /**
     * @param {number} N
     * @param {boolean} numonly
     * @returns {Array<number|string>}
     */
    const getKeys = (N, numonly) => {
        const keys = [];
        for (let j = 0; j < N; j ++) {
            keys.push(getKey(numonly && (j === 0)));
        }
        return keys;
    }
    const getValue = (keys) => {
        let work;
        switch (keys[0]) {
            case 0:work = tmpdomain;break;
            case 1:work = account;break;
            case 2:work = achidata;break;
            default:return {value:null,err:{position,message:`invalid domain (${keys[0]})`}};
        }
        for (let j = 1, l = keys.length; j < l; j ++) {
            const k = keys[j];
            if (Array.isArray(work) && typeof k === "string") {
                work = work.map(v=>v[k]);
            }
            if (!(k in work)) {
                return undefined;
            }
            work = work[k];
        }
        return work;
    };
    const setValue = (keys, value) => {
        let work;
        switch (keys[0]) {
            case 0:work = tmpdomain;break;
            case 1:return {value:null,err:{position,message:"attempt to write to account record"}};
            case 2:work = achidata;break;
            default:return {value:null,err:{position,message:`invalid domain (${keys[0]})`}};
        }
        for (let j = 1, l = keys.length-1; j < l; j ++) {
            if (!(keys[j] in work)) {
                work[keys[j]] = {};
            }
            work = work[keys[j]];
            if (typeof work !== "object") {
                return {value:null,err:{position,message:"invalid set operation"}};
            }
        }
        work[keys[keys.length-1]] = value;
    };
    /**
     * @returns {AchiCodeResult}
     */
    const getLocation = () => {
        const N = code[i++];
        const domain = code[i++];
        if (domain === 0) {
            return getKeys(N, true);
        } else if (domain === 1) {
            return getKeys(N, false);
        } else if (domain === 2) {
            return getKeys(N, false);
        } else {
            return {value:null,err:{position,message:`invalid domain (${domain})`}};
        }
    };
    /**
     * @returns {AchiCodeResult}
     */
    const getImmediate = () => {
        const type = code[i++]&0x7f;
        if (type === 10) {
            const l = code[i++];
            const s = code.subarray(i, i+l).toString("utf8");
            i += l;
            return s;
        }
        if (type === 0) {
            return null;
        }
        switch (type) {
            case 1:return code[i++];
            case 2:i += 2;return code.readUint16BE(i-2);
            case 3:i += 4;return code.readUint32BE(i-4);
            case 4:i += 8;return Number(code.readBigUint64BE(i-8));
            case 5:i += 1;return code.readInt8(i-1);
            case 6:i += 2;return code.readInt16BE(i-2);
            case 7:i += 4;return code.readInt32BE(i-4);
            case 8:i += 8;return Number(code.readBigInt64BE(i-8));
            case 9:i += 8;return code.readDoubleBE(i-8);
        }
        return {value:null,err:{position,message:`invalid immediate type (${type})`}};
    };
    /**
     * @returns {AchiCodeResult}
     */
    const getOperand = () => {
        if (code[i] & 0x80) {
            return getImmediate();
        } else {
            const loc = getLocation();
            if (loc.err) {
                return loc;
            }
            return getValue(loc);
        }
    };
    /**
     * @param {number|string|null|Array<number|string>} op1
     * @param {number} operation
     * @returns {AchiCodeResult}
     */
    const doOp = (op1, operation) => {
        if (operation === 0 || operation === 7 || operation === 10) {
            switch (operation) {
                case 0:return op1;
                case 7:return Number(!op1);
                case 10:return ~op1;
            }
        } else {
            const op2 = getOperand();
            if (op2?.err) {
                return op2;
            }
            switch (operation) {
                case 1:return op1+op2;
                case 2:return op1-op2;
                case 3:return op1*op2;
                case 4:return op1/op2;
                case 5:return Math.floor(op1/op2);
                case 6:return op1%op2;
                case 8:return Number(op1&&op2);
                case 9:return Number(op1||op2);
                case 11:return op1&op2;
                case 12:return op1|op2;
                case 13:return op1^op2;
                case 14:return op1<<op2;
                case 15:return op1>>op2;
                case 16:return Number(op1===op2);
                case 17:return Number(op1>op2);
                case 18:return Number(op1<op2);
                case 19:return Number(op1>=op2);
                case 20:return Number(op1<=op2);
                default:return {value:null,err:{position,message:`invalid operation (${operation})`}};
            }
        }
    };
    while (i < code.length) {
        position = i;
        const discriminator = code[i++];
        if (discriminator === 0) {
            const dstkeys = getLocation();
            if (dstkeys.err) {
                return dstkeys;
            }
            const op1 = getOperand();
            if (op1?.err) {
                return op1;
            }
            const operation = code[i++];
            try {
                const result = doOp(op1, operation);
                if (result?.err) {
                    return result;
                }
                setValue(dstkeys, result);
            } catch (e) {
                return {value:null,err:{position,message:"JS error occurred"}};
            }
        } else if (discriminator === 1) {
            const expr = code[i++];
            switch (expr) {
                case 0: {
                    return getOperand();
                }
                case 1: {
                    const op1 = getOperand();
                    if (op1?.err) {
                        return op1;
                    }
                    const imm = getImmediate();
                    if (imm?.err) {
                        return imm;
                    }
                    if (!Number.isInteger(imm) || imm < 0) {
                        return {value:null,err:{position,message:`immediate value must be non-negative integer, got: ${imm}`}};
                    }
                    if (!op1) {
                        i += imm;
                    }
                    break;
                }
                case 3: {
                    const key = code[i++];
                    const l = code[i++];
                    const s = code.subarray(i, i+l).toString("utf8");
                    i += l;
                    let result;
                    switch (s) {
                        case "contains": {
                            const opa = getOperand();
                            if (opa?.err) {
                                return opa;
                            }
                            if (!Array.isArray(opa)) {
                                return {value:null,err:{position,message:"first operand to contains must be an array"}};
                            }
                            const opb = getOperand();
                            if (opb?.err) {
                                return opb;
                            }
                            result = Number(opa.includes(opb));
                            break;
                        }
                        case "getusergroups": {
                            const opa = getOperand();
                            if (opa?.err) {
                                return opa;
                            }
                            return {value:null,err:{position,message:"user groups not implemented"}};
                        }
                        case "getusergroupids": {
                            const opa = getOperand();
                            if (opa?.err) {
                                return opa;
                            }
                            return {value:null,err:{position,message:"user groups not implemented"}};
                        }
                        case "time": {
                            result = Date.now();
                            break;
                        }
                        case "year": {
                            const opa = getOperand();
                            if (opa?.err) {
                                return opa;
                            }
                            if (typeof opa !== "number") {
                                return {value:null,err:{position,message:"timestamp must be a number"}};
                            }
                            return new Date(opa).getUTCFullYear();
                        }
                        default: {
                            return {value:null,err:{position,message:`unknown invocation target (${s})`}};
                        }
                    }
                    tmpdomain[key] = result;
                    break;
                }
            }
        } else {
            return {value:null,err:{position,message:`unknown discriminator (${discriminator})`}};
        }
    }
    return {value:null,err:null};
}

/**
 * @todo implement
 * @param {Buffer} code
 * @returns {boolean}
 */
function validateAchiCode(code) {
    return true;
}

exports.executeAchiCode = executeAchiCode;
exports.validateAchiCode = validateAchiCode;
