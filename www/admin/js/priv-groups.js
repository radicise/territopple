(async () => {
    await INCLUDE_FINISHED;
    /**@type {typeof import("../../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");

    await makeCreateForm(perms);
})();

/**
 * @param {typeof import("../../../commonjs/perms.mjs")} perms
 */
async function makeCreateForm(perms) {
    /**@type {HTMLDivElement} */
    const modal = document.getElementById("create-form");
    /**@type {HTMLInputElement} */
    const name_input = document.getElementById("pg-cf-name");
    /**
     * @param {number} priv
     * @returns {HTMLDivElement}
     */
    function makePrivSelect(priv) {
        const privname = perms.PRIVILEGES[priv];
        const lab = document.createElement("label");
        const inp = document.createElement("input");
        inp.id = `pg-cf-priv-${priv}`;
        lab.htmlFor = inp.id;
        inp.type = "checkbox";
        lab.textContent = `${privname}`;
        inp._priv = priv;
        const cont = document.createElement("div");
        cont.replaceChildren(inp, lab);
        return cont;
    }
    /**@type {HTMLDivElement} */
    const privSelectCont = document.getElementById("pg-cf-privs");
    for (const priv in perms.PRIVILEGES) {
        privSelectCont.appendChild(makePrivSelect(Number(priv)));
    }
    document.getElementById("pg-cf-cancel").onclick = () => {
        modal.hidden = true;
        for (let i = 0, l = privSelectCont.children.length; i < l; i ++) {
            privSelectCont.children[i].children[0].checked = false;
        }
        name_input.value = "";
    };
}

fetch(`https://${document.location.hostname}/acc/admin/pgrp/list?page=1`, {method:"GET"}).then(res => {
    if (res.ok) {
        res.json().then(data => console.log(data));
    } else {
        res.text().then(data => console.log(data));
    }
});

