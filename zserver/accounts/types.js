const mdb = require("mongodb");

/**
 * @typedef AppealRejectionRecord
 * @type {{
 * source:string,
 * date:number,
 * notes:string,
 * appeal:string,
 * value:number
 * }}
 */

/**
 * @typedef SanctionRecord
 * @type {{
 * sanction_id:number,
 * value:number,
 * source:string,
 * applied:number,
 * expires:number,
 * notes:string,
 * appeal:string|null,
 * appeal_date:number,
 * appealable_date:number,
 * appeals_left:number,
 * appeal_granted:number,
 * granted_by:string|null,
 * rejections:AppealRejectionRecord[]
 * }}
 */

/**
 * @typedef AccountRecord
 * @type {{
 * _id:mdb.ObjectId,
 * id:string,
 * name:string,
 * email:string,
 * pwdata:Buffer,
 * last_online:number,
 * cdate:number,
 * level:number,
 * priv_level:number,
 * priv_groups:number[],
 * sanction:SanctionRecord[],
 * solved:number[],
 * flagf1:number?,
 * friends:string[]?,
 * incoming_friends:string[]?,
 * outgoing_friends:string[]?,
 * devtst:boolean?
 * }}
 */

/**
 * @typedef {{gid:number,name:string,privs:number}} PrivGroupRecord
 */

/**
 * @constant
 * @readonly
 * @see [flags.txt](../docs/accounts/flags.txt)
 */
const FlagF1 = Object.seal({
    /**@readonly */
    FRIEND_F_STRANGER: 1,
    /**@readonly */
    FRIEND_F_SAMEROOM: 2,
    /**@readonly */
    FRIEND_F_FOF: 4
});

/**
 * @param {number} field
 * @param {number} mask
 * @returns {boolean}
 */
function checkFlag (field, mask) {
    if ((field ?? null) === null) {
        return false;
    }
    return field & mask !== 0;
}

exports.AppealRejectionRecord = this.AppealRejectionRecord;
exports.SanctionRecord = this.SanctionRecord;
exports.AccountRecord = this.AccountRecord;
exports.PrivGroupRecord = this.PrivGroupRecord;
exports.FlagF1 = FlagF1;
exports.checkFlag = checkFlag;
