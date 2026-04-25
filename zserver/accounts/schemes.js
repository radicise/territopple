const { JSONScheme } = require("../../defs.js");

/**@type {JSONScheme} */
const accCreationScheme = {
    "id": "string",
    "name": "string",
    "pw": "string",
    "email": "string"
};
/**@type {JSONScheme} */
const accLoginScheme = {
    "id": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accNameChangeScheme = {
    "id": "string",
    "name": "string"
};
/**@type {JSONScheme} */
const accFlagsChangeScheme = {
    "id": "string",
    "flagf": "number"
};
/**@type {JSONScheme} */
const accPWChangeScheme = {
    "id": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accUpdateScheme = {
    "id": "string",
    "k": "string",
    "v": "string"
};
/**@type {JSONScheme} */
const accPWResetCodeScheme = {
    "code": "string",
    "pw": "string"
};
/**@type {JSONScheme} */
const accPWResetScheme = {
    "id": "string",
    "email": "string"
};
/**@type {JSONScheme} */
const friendReqScheme = {
    "id": "string"
};
/**@type {JSONScheme} */
const sanctionScheme = {
    "acc": "string",
    "id": "number",
    "bypass": "boolean",
    "value": "number",
    "expires": "number",
    "appeals": "number",
    "notes": "string"
};
/**@type {JSONScheme} */
const appealScheme = {
    "refid": "number",
    "message": "string"
};

/**@type {JSONScheme} */
const adminSancManScheme = {
    "acc": "string",
    "refid": "number",
    "cancel?": "boolean",
    "value?": "number",
    "expires?": "number",
    "notes?": "string",
    "appeal?": "any"
};
/**@type {JSONScheme} */
const adminSancManAppealScheme = {
    "accept": "boolean",
    "notes?": "string",
    "value?": "number"
};

exports.accCreationScheme = accCreationScheme;
exports.accLoginScheme = accLoginScheme;
exports.accNameChangeScheme = accNameChangeScheme;
exports.accFlagsChangeScheme = accFlagsChangeScheme;
exports.accPWChangeScheme = accPWChangeScheme;
exports.accUpdateScheme = accUpdateScheme;
exports.accPWResetCodeScheme = accPWResetCodeScheme;
exports.accPWResetScheme = accPWResetScheme;
exports.friendReqScheme = friendReqScheme;
exports.sanctionScheme = sanctionScheme;
exports.appealScheme = appealScheme;

exports.adminSancManScheme = adminSancManScheme;
exports.adminSancManAppealScheme = adminSancManAppealScheme;
