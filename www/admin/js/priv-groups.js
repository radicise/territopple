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
    /**@type {HTMLParagraphElement} */
    const error_area = document.getElementById("pg-cf-error");
    /**@type {HTMLSpanElement} */
    const error_text = error_area.children[1];
    /**@type {HTMLDivElement} */
    const result_modal = document.getElementById("create-result");
    /**@type {HTMLParagraphElement} */
    const result_message = document.getElementById("pg-cr-msg");
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
    function clearForm() {
        for (let i = 0, l = privSelectCont.children.length; i < l; i ++) {
            privSelectCont.children[i].children[0].checked = false;
        }
        name_input.value = "";
        error_area.hidden = true;
    }
    /**@type {HTMLDivElement} */
    const privSelectCont = document.getElementById("pg-cf-privs");
    for (const priv in perms.PRIVILEGES) {
        privSelectCont.appendChild(makePrivSelect(Number(priv)));
    }
    document.getElementById("pg-cf-cancel").onclick = () => {
        modal.hidden = true;
        clearForm();
    };
    document.getElementById("pg-cf-confirm").onclick = () => {
        const name = name_input.value;
        let privs = 0;
        for (let i = 0, l = privSelectCont.children.length; i < l; i ++) {
            /**@type {HTMLInputElement} */
            const sel = privSelectCont.children[i].children[0];
            if (sel.checked) {
                privs |= (1<<(sel._priv));
            }
        }
        if (privs === 0) {
            error_text.textContent = "Must select at least one privilege";
            error_area.hidden = false;
            return;
        }
        if (name.length === 0) {
            error_text.textContent = "Must enter a valid name";
            error_area.hidden = false;
            return;
        }
        fetch(`https://${document.location.hostname}/acc/admin/pgrp/create`, {method:"POST",body:JSON.stringify({name,flags:privs})}).then(r1 => {
            if (r1.ok) {
                r1.text().then(t1 => {
                    clearForm();
                    modal.hidden = true;
                    result_message.textContent = `Group '${name}' created successfully, group id ${t1}`;
                    result_modal.hidden = false;
                });
            } else {
                switch (r1.status) {
                    case 403:case 500: {
                        r1.text().then(t1 => {
                            clearForm();
                            modal.hidden = true;
                            result_message.textContent = `Error: ${t1}`;
                            result_modal.hidden = false;
                        });
                        return;
                    }
                    default: {
                        r1.text().then(t1 => {
                            error_text.textContent = t1;
                            error_area.hidden = false;
                        });
                        return;
                    }
                }
            }
        });
    };
}

fetch(`https://${document.location.hostname}/acc/admin/pgrp/list?page=1`, {method:"GET"}).then(res => {
    if (res.ok) {
        res.json().then(data => console.log(data));
    } else {
        res.text().then(data => console.log(data));
    }
});

