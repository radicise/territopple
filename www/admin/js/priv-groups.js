/**@typedef {typeof import("../../../commonjs/perms.mjs")} PERMS */

/**@typedef {{gid:number,name:string,privs:number,members:number}} PGData */

const defaultEditFunc = async () => {};
let afterEditFunc = defaultEditFunc;
/**@type {PGData} */
let currEditData = null;

(async () => {
    await INCLUDE_FINISHED;
    await new Promise(r => {
        document.getElementById("ADMIN-CHECK-FLAG").addEventListener("click", r, {once:true});
    });
    /**@type {typeof import("../../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");

    await makeCreateForm(perms);
    const { refreshPGList } = makeEditForm(perms);
    refreshPGList(1);
})();

/**
 * @param {number} gid group id
 * @param {string} name group name
 * @param {string} dpriv displayed privilege
 * @param {number} mem_count member count
 * @param {VoidFunction} onclick
 * @returns {HTMLElement}
 */
function makePGListEntry(gid, name, dpriv, mem_count, onclick) {
    const row = document.createElement("tr");
    row.replaceChildren(...make([
        ["td",{textContent:`${gid}`}],
        ["td",{textContent:name}],
        ["td",{textContent:dpriv}],
        ["td",{textContent:`${mem_count}`}],
        ["td",{children:[make("input",{"type":"button","value":"edit","onclick":onclick})]}]
    ]));
    return row;
}

/**
 * @param {PERMS} perms
 * @param {number} privs
 * @returns {string}
 */
function getHighestPriv(perms, privs) {
    let highest = "NONE";
    for (let i = 31; i >= 0; i --) {
        if (privs & (1<<i)) {
            highest = perms.PRIVILEGES[i];
            break;
        }
    }
    return highest;
}

/**
 * @param {PERMS} perms
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

/**
 * @param {PERMS} perms
 */
function makeEditForm(perms) {
    /**@type {HTMLDivElement} */
    const modal = document.getElementById("edit-form");
    /**@type {HTMLDivElement} */
    const name_area = document.getElementById("pg-ef-name-update");
    /**@type {HTMLInputElement} */
    const name_input = document.getElementById("pg-ef-name");
    /**@type {HTMLParagraphElement} */
    const error_area = document.getElementById("pg-ef-error");
    /**@type {HTMLSpanElement} */
    const error_text = error_area.children[1];
    /**@type {HTMLDivElement} */
    const result_modal = document.getElementById("create-result");
    /**@type {HTMLParagraphElement} */
    const result_message = document.getElementById("pg-cr-msg");
    /**@type {HTMLInputElement} */
    const yupdate_radio = document.getElementById("pg-ef-yupdate");
    /**@type {HTMLInputElement} */
    const nupdate_radio = document.getElementById("pg-ef-nupdate");
    /**@type {HTMLSpanElement} */
    const member_status = document.getElementById("pg-ef-memstatus");
    /**@type {HTMLInputElement} */
    const member_accid = document.getElementById("pg-ef-member");
    let currPageData = null;
    /**
     * @param {number} priv
     * @returns {HTMLDivElement}
     */
    function makePrivSelect(priv) {
        const privname = perms.PRIVILEGES[priv];
        const lab = document.createElement("label");
        const inp = document.createElement("input");
        inp.id = `pg-ef-priv-${priv}`;
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
        name_area.hidden = true;
        yupdate_radio.checked = false;
        nupdate_radio.checked = true;
        member_status.textContent = "";
        member_accid.value = "";
    }
    /**@type {HTMLDivElement} */
    const privSelectCont = document.getElementById("pg-ef-privs");
    for (const priv in perms.PRIVILEGES) {
        privSelectCont.appendChild(makePrivSelect(Number(priv)));
    }
    yupdate_radio.onchange = function () {
        name_area.hidden = !this.checked;
    };
    nupdate_radio.onchange = function () {
        name_area.hidden = this.checked;
    };
    document.getElementById("pg-ef-cancel").onclick = () => {
        modal.hidden = true;
        clearForm();
    };
    document.getElementById("pg-ef-confirm").onclick = () => {
        const name = yupdate_radio.checked ? name_input.value : currEditData.name;
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
        fetch(`https://${document.location.hostname}/acc/admin/pgrp/update`, {method:"POST",body:JSON.stringify({name,flags:privs,gid:currEditData.gid})}).then(r1 => {
            if (r1.ok) {
                r1.text().then(t1 => {
                    clearForm();
                    modal.hidden = true;
                    result_message.textContent = `Group '${name}' updated successfully (id ${currEditData.gid})`;
                    result_modal.hidden = false;
                    afterEditFunc();
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
    /**
     * @param {PGData} data
     * @param {{page:number,count?:number,filter?:string}} pageinfo
     */
    function showEditModal(data, pageinfo) {
        currEditData = data;
        name_input.value = data.name;
        for (const priv in perms.PRIVILEGES) {
            const shift = Number(priv);
            /**@type {HTMLInputElement} */
            const box = document.getElementById(`pg-ef-priv-${priv}`);
            if (data.privs & (1<<shift)) {
                box.checked = true;
            } else {
                box.checked = false;
            }
        }
        afterEditFunc = () => {
            refreshPGList(pageinfo.page,{pagesize:pageinfo.count,namefilter:pageinfo.filter});
            afterEditFunc = defaultEditFunc;
        };
        modal.hidden = false;
    }
    /**
     * @param {number} page
     * @param {{pagesize?:number,namefilter?:string}?} options
     */
    async function refreshPGList(page, options) {
        currPageData = {page,count:options?.pagesize,filter:options?.namefilter};
        let params = `page=${page}`;
        if (options?.pagesize) {
            params += `&count=${options.pagesize}`;
        }
        if (options?.namefilter) {
            params += `&name=${options.namefilter}`;
        }
        const res = await fetch(`https://${document.location.hostname}/acc/admin/pgrp/list?${params}`, {method:"GET"});
        if (!res.ok) {
            alert(`${res.status}: ${await res.text()}`);
            return;
        }
        /**@type {{total:number,pagesize:number,groups:PGData[]}} */
        const data = await res.json();
        document.getElementById("pg-lc-pagecount").textContent = `${Math.ceil(data.total/data.pagesize)}`;
        document.getElementById("pg-lc-cpage").value = page;
        const rows = data.groups.map(v => makePGListEntry(v.gid, v.name, getHighestPriv(perms, v.privs), v.members, ()=>{showEditModal(v,currPageData)}));
        /**@type {HTMLTableSectionElement} */
        const list = document.getElementById("pg-list").children[1];
        list.replaceChildren(...rows);
    }
    const assignGroup = (add) => {
        fetch(`https://${document.location.hostname}/acc/admin/pgrp/assign`, {method:"POST",body:JSON.stringify({gid:currEditData.gid,accid:member_accid.value,add})}).then(r1 => {
            r1.text.then(t1 => {
                member_status.textContent = t1;
                refreshPGList(currPageData.page,{pagesize:currPageData.count,namefilter:currPageData.filter});
            });
        });
    };
    document.getElementById("pg-ef-addm").onclick = () => {
        assignGroup(true);
    };
    document.getElementById("pg-ef-remm").onclick = () => {
        assignGroup(false);
    };
    return { refreshPGList };
}

// fetch(`https://${document.location.hostname}/acc/admin/pgrp/list?page=1`, {method:"GET"}).then(res => {
//     if (res.ok) {
//         res.json().then(data => console.log(data));
//     } else {
//         res.text().then(data => console.log(data));
//     }
// });

