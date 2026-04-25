const { settings } = require("../../defs.js");

const ACC_CREAT_TIMEOUT = settings.ACC?.CREATE_TO ?? 600000;
const SESS_TIMEOUT = settings.ACC?.SESSION_TO ?? 1000*60*60*24;
const ACC_PWRST_TIMEOUT = settings.ACC?.PWRST_TO  ?? 600000;
const ACC_MAX_NAME_LEN = settings.ACC?.NAME_MAX ?? 25;
const ACC_PFP_UPLOAD_TIMEOUT = settings.ACC?.PFPUP_TO ?? 10000;

const EACCESS = "logs/accounts/access.txt";
const EREJECT = "logs/accounts/rejected.txt";
const ESENSITIVE = "logs/accounts/sensitive.txt"; // used to log sensitive operations (eg. account creation, password change)
const EERROR = "logs/accounts/error.txt";
const IACCESS = "logs/accounts/iaccess.txt";
const EBADMOD = "logs/accounts/ebadmod.txt";

const ACC_PUB_PREFIX = "/acc/pub";
const ACC_ADMIN_PREFIX = "/acc/admin";

exports.ACC_CREAT_TIMEOUT = ACC_CREAT_TIMEOUT;
exports.SESS_TIMEOUT = SESS_TIMEOUT;
exports.ACC_PWRST_TIMEOUT = ACC_PWRST_TIMEOUT;
exports.ACC_MAX_NAME_LEN = ACC_MAX_NAME_LEN;
exports.ACC_PFP_UPLOAD_TIMEOUT = ACC_PFP_UPLOAD_TIMEOUT;
exports.EACCESS = EACCESS;
exports.EREJECT = EREJECT;
exports.ESENSITIVE = ESENSITIVE;
exports.EERROR = EERROR;
exports.IACCESS = IACCESS;
exports.EBADMOD = EBADMOD;
exports.ACC_PUB_PREFIX = ACC_PUB_PREFIX;
exports.ACC_ADMIN_PREFIX = ACC_ADMIN_PREFIX;
