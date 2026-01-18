/**
 * @file
 * this file provides helpers to query specific permissions by common names
 */

/**
 * List of permissions/privileges.
 * @\type {{readonly [x: string]: number}}
 * @constant
 * @readonly
 * @see [priv.txt](../docs/accounts/priv.txt)
 */
const Permissions = Object.seal({
    /**
     * (N)
     * 
     * can delete chat message and replays, and flag accounts and puzzles for priority review
     * @readonly
     * @type {0}
     * @constant
     */
    MODERATE:0,
    /**
     * (G[Junior Moderator])
     * 
     * apply group 1 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {1}
     * @constant
     */
    APPLY_G1_SANCTION:1,
    /**
     * (G[Moderator])
     * 
     * apply group 2 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {2}
     * @constant
     */
    APPLY_G2_SANCTION:2,
    /**
     * (G[Moderator])
     * 
     * review group 1 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {3}
     * @constant
     */
    REVIEW_G1_SANCTION:3,
    /**
     * (G[Moderator])
     * 
     * review group 2 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {3}
     * @constant
     */
    REVIEW_G2_SANCTION:3,
    /**
     * (G[Senior Moderator])
     * 
     * apply group 3 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {4}
     * @constant
     */
    APPLY_G3_SANCTION:4,
    /**
     * (G[Senior Moderator])
     * 
     * review group 3 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {5}
     * @constant
     */
    REVIEW_G3_SANCTION:5,
    /**
     * (G[Puzzle Reviewer])
     * 
     * review puzzle submissions and reports
     * @readonly
     * @type {6}
     * @constant
     */
    REVIEW_PUZZLES:6,
    /**
     * (N)
     * 
     * manage puzzles, including modification and deletion
     * @readonly
     * @type {7}
     * @constant
     */
    MANAGE_PUZZLES:7,
    /**
     * (G[Event Manager])
     * 
     * manage events
     * @see (events.txt)[../docs/events/events.txt]
     * @readonly
     * @type {8}
     * @constant
     */
    MANAGE_EVENTS:8,
    /**
     * the domain boundary indicates permissions that require the account email domain to match server configuration or a special exemption in server configuration
     * @readonly
     * @type {28}
     * @constant
     */
    __DOMAIN_BOUNDARY:28,
    /**
     * (H)
     * 
     * allows the account to see all privileges possessed by other accounts
     * @readonly
     * @type {28}
     * @constant
     */
    READ_PRIV_FLAGS:28,
    /**
     * (A[*])
     * 
     * can apply authorized privilege groups to accounts according to group and account specific allowlists
     * @readonly
     * @type {29}
     * @constant
     */
    APPLY_PRIV_GROUPS:29,
    /**
     * (N)
     * 
     * apply group 4 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {30}
     * @constant
     */
    APPLY_G4_SANCTION:30,
    /**
     * (N)
     * 
     * review group 4 sanctions
     * @see [sanctions.txt](../docs/accounts/sanctions.txt)
     * @readonly
     * @type {30}
     * @constant
     */
    REVIEW_G4_SANCTION:30,
    /**
     * (A[*])
     * 
     * allows full control over privilege groups and own and others privileges
     * @readonly
     * @type {31}
     * @constant
     */
    PRIV_ADMIN:31
});

/**
 * @param {number} flags
 * @param {...number} perms
 * @returns {boolean}
 */
function check_permission(flags, ...perms) {
    return perms.some(perm=>(flags & (1<<perm)) !== 0);
}

/**
 * checks that the source is allowed to moderate the target based on privileges
 * @param {number} source
 * @param {number} target
 * @returns {boolean}
 */
function check_can_moderate(source, target) {
    // priv admins have full trust, DB admin must strip this privilege before sanctioning
    if (check_permission(target, Permissions.PRIV_ADMIN)) return false;
    // moderation actions cannot be applied to those of higher moderation level
    if (get_sanction_perms(target).lastIndexOf(true) >= get_sanction_perms(source).lastIndexOf(true)) return false;
    return true;
}

/**
 * @param {number} source
 * @returns {boolean[]}
 */
function get_sanction_perms(source) {
    return [check_permission(source, Permissions.APPLY_G1_SANCTION),check_permission(source, Permissions.APPLY_G2_SANCTION),check_permission(source, Permissions.APPLY_G3_SANCTION),check_permission(source, Permissions.APPLY_G4_SANCTION)];
}

/**
 * @param {number} source
 * @param {number} sid
 * @returns {boolean}
 */
function check_sanction_allowed(source, sid) {
    // bypass flag requires priv admin or apply priv groups
    if (sid&0x80000000) {return check_permission(source, Permissions.PRIV_ADMIN,Permissions.APPLY_PRIV_GROUPS);}
    switch (sid) {
        case 0:case 1:case 2:case 10:
            return check_permission(source, Permissions.APPLY_G1_SANCTION);
        case 3:case 11:
            return check_permission(source, Permissions.APPLY_G2_SANCTION);
        case 4:case 5:
            return check_permission(source, Permissions.APPLY_G3_SANCTION);
        case 6:case 7:
            return check_permission(source, Permissions.APPLY_G4_SANCTION);
        // sanction ids not covered here default to false
        default:
            return false;
    }
}

exports.Permissions = Permissions;
exports.check_permission = check_permission;
exports.check_can_moderate = check_can_moderate;
exports.check_sanction_allowed = check_sanction_allowed;
