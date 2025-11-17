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
 * @param {number} perm
 * @returns {boolean}
 */
function check_permission(flags, perm) {
    return (flags & (1<<perm)) !== 0;
}

exports.Permissions = Permissions;
exports.check_permission = check_permission;
