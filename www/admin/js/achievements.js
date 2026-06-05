(async () => {
    await INCLUDE_FINISHED;
    await new Promise(r => {
        document.getElementById("ADMIN-CHECK-FLAG").addEventListener("click", r, {once:true});
    });
    /**@typedef {import("../../../zserver/accounts/types.js").AccountRecord} AccountRecord */
    /**@type {typeof import("../../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");
    /**@type {string} */
    const ownid = (await (await fetch(`https://${document.location.hostname}/acc/admin/check`, {method:"GET"})).json()).name;
    /**@type {AccountRecord} */
    const ownrec = await (await fetch(`https://${document.location.hostname}/acc/admin/info?id=${ownid}`, {method:"GET"})).json();
    /**@type {number} */
    const ownprivs = (await (await fetch(`https://${document.location.hostname}/acc/admin/privs`, {method:"GET"})).json()).privs;
    perms.PRIVILEGES
})();