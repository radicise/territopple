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
 * appealable_date:number,
 * appeals_left:number,
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
 * sanction:null|SanctionRecord[],
 * solved:number[]
 * }}
 */

exports.AppealRejectionRecord = this.AppealRejectionRecord;
exports.SanctionRecord = this.SanctionRecord;
exports.AccountRecord = this.AccountRecord;
