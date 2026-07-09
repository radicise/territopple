/**
 * search result kind (eg. action, achievement)
 * @type {HTMLSelectElement}
 */
const SEARCH_KIND = document.getElementById("search-kind");
/**
 * search name filter [type="text"]
 * @type {HTMLInputElement}
 */
const SEARCH_NAME = document.getElementById("search-name");
/**
 * search go button [type="button"]
 * @type {HTMLInputElement}
 */
const SEARCH_GO = document.getElementById("search-go");
/**
 * container for search results
 * @type {HTMLDivElement}
 */
const SEARCH_RESULTS = document.getElementById("search-results");
/**
 * input for which page to go to [type="number"]
 * @type {HTMLInputElement}
 */
const PAGE_INPUT = document.getElementById("search-page-in");
/**
 * number of pages text
 * @type {HTMLSpanElement}
 */
const PAGE_COUNT = document.getElementById("search-page-count");
/**
 * go to page button [type="button"]
 * @type {HTMLInputElement}
 */
const PAGE_GO = document.getElementById("search-page-go");
/**
 * commit staged changes [type="button"]
 * @type {HTMLInputElement}
 */
const STAGED_COMMIT = document.getElementById("staged-commit");
/**
 * discard staged changes [type="button"]
 * @type {HTMLInputElement}
 */
const STAGED_DISCARD = document.getElementById("staged-discard");
/**
 * list of staged changes
 * @type {HTMLDivElement}
 */
const STAGED_LIST = document.getElementById("staged-list");
/**
 * details pane for actions
 * @type {HTMLDivElement}
 */
const ACTION_DETAILS = document.getElementById("action-details");
/**
 * details pane for action groups
 * @type {HTMLDivElement}
 */
const AGROUP_DETAILS = document.getElementById("agroup-details");
/**
 * details pane for achievements
 * @type {HTMLDivElement}
 */
const ACHIEVE_DETAILS = document.getElementById("achieve-details");
/**
 * details pane for errors
 * @type {HTMLDivElement}
 */
const ERROR_DETAILS = document.getElementById("error-details");
/**
 * empty panel, shown when no other panels are active
 * @type {HTMLDivElement}
 */
const BLANK_DETAILS = document.getElementById("blank-details");

/**@type {TTVariablePanelGroup} */
const DETAILS_PANE = document.getElementById("item-details");

/**
 * edit button for item details
 * @type {HTMLInputElement}
 */
const IDCA_EDIT = document.getElementById("idca-edit");
/**
 * delete button for item details
 * @type {HTMLInputElement}
 */
const IDCA_DELETE = document.getElementById("idca-delete");
/**
 * cancel button for staged changes under review
 * @type {HTMLInputElement}
 */
const IDCA_CANCEL = document.getElementById("idca-cancel");
/**
 * button to save changes to staged list
 * @type {HTMLInputElement}
 */
const IDCA_STAGE = document.getElementById("idca-stage");
/**
 * name/id input for creating items
 * @type {HTMLInputElement}
 */
const SEARCHC_NAME = document.getElementById("search-create-name");
/**
 * type for creating items
 * @type {HTMLSelectElement}
 */
const SEARCHC_TYPE = document.getElementById("search-create-type");
/**
 * create button for items
 * @type {HTMLInputElement}
 */
const SEARCHC_BUTTON = document.getElementById("search-create");


/**@type {{resp:{count:number,list:object[]},kind:"acts"|"achi",page:number,search:string}} */
const query_data = {
    resp: {
        count: 0,
        list: []
    },
    kind: "achi",
    page: 1,
    search: ""
};
/**
 * @template T
 * @template U
 * @typedef {import("../../../zserver/accounts/achi/primary.js").BulkChange<T,U>} BulkChange */
/**
 * @template T
 * @template U
 * @typedef {import("../../../zserver/accounts/achi/primary.js").BulkChangeR<T,U>} BulkChangeR */
/**@typedef {import("../../../zserver/accounts/achi/types.js").Action} Action */
/**@typedef {import("../../../zserver/accounts/achi/types.js").ActionGroup} ActionGroup */
/**@typedef {import("../../../zserver/accounts/achi/types.js").ActionLike} ActionLike */
/**@typedef {import("../../../zserver/accounts/achi/types.js").AchiDef} AchiDef */
/**@type {{acts:BulkChangeR<ActionLike,string>&{delete:Set<string>},achi:BulkChangeR<AchiDef,number>&{delete:Set<number>}}} */
const writeData = {acts:{create:{},update:{},delete:new Set()},achi:{create:{},update:{},delete:new Set()}};
/**@type {{acts:Record<string,ActionLike>,achi:Record<number,AchiDef>}} */
const origData = {acts:{},achi:{}};
/**@type {{acts:Set<string>,achi:Set<number>}} */
const stagedIds = {acts:new Set(),achi:new Set()};

// let activePanel = BLANK_DETAILS;

/**
 * executes the provided string in the internal context and returns the result
 * @param {string} thing
 * @returns {any}
 */
let _ACHIEVEMENTS_DEBUG_DO = (thing) => {};

/**
 * @param {number} n
 * @returns {boolean[]}
 */
function numberToField(n) {
    const f = new Array(32).fill(false);
    for (let i = 0; i < 32; i ++) {
        f[i] = Boolean(n&(1<<i));
    }
    return f;
}
/**
 * @param {boolean[]} f
 * @returns {number}
 */
function fieldToNumber(f) {
    let n = 0;
    for (let i = 0; i < 32; i ++) {
        if (f[i]) n |= (1<<i);
    }
    return n;
}

/**
 * @enum {number}
 */
const ActState = {
    VIEW: 0,
    CREATE: 1,
    UPDATE: 2,
};

/**@type {ActState} */
let action_state = ActState.VIEW;
let curr_detail_id = null;
/**@type {ActionLike|AchiDef} */
let curr_detail_data = null;
/**@type {"view"|"modify"|"review"|"review-mod"} */
let curr_detail_mode = "view";

(async () => {
    await INCLUDE_FINISHED;
    await new Promise(r => {
        document.getElementById("ADMIN-CHECK-FLAG").addEventListener("click", r, {once:true});
    });
    /**@typedef {import("../../../zserver/accounts/types.js").AccountRecord} AccountRecord */
    /**@type {typeof import("../../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");
    populateTPerms();
    /**@type {string} */
    const ownid = (await (await fetch(`https://${document.location.hostname}/acc/admin/check`, {method:"GET"})).json()).name;
    /**@type {AccountRecord} */
    const ownrec = await (await fetch(`https://${document.location.hostname}/acc/admin/info?id=${ownid}`, {method:"GET"})).json();
    /**@type {number} */
    const ownprivs = (await (await fetch(`https://${document.location.hostname}/acc/admin/privs`, {method:"GET"})).json()).privs;
    DETAILS_PANE.getSharedComponent("change-actions").setDefault("input", (e)=>{e.hidden=false;});


    let search_request_lock = false;


    SEARCH_GO.onclick = () => {
        if (search_request_lock) return;
        query_data.kind = SEARCH_KIND.value;
        query_data.search = SEARCH_NAME.value;
        query_data.page = 1;
        doSearch();
    };
    PAGE_GO.onclick = () => {
        if (search_request_lock) return;
        query_data.page = PAGE_INPUT.valueAsNumber;
        doSearch();
    };

    SEARCHC_BUTTON.onclick = () => {
        if (SEARCHC_NAME.value.length === 0) return;
        switch (SEARCHC_TYPE.value) {
            case "acts": {
                const id = '+'+SEARCHC_NAME.value;
                writeData.acts.create[id] = {id,perm:[],data:[0,0]};
                renderDetails(`acts.c.${id}`, "modify");
                break;
            }
            case "agrp": {
                const id = '-'+SEARCHC_NAME.value;
                writeData.acts.create[id] = {id,acts:[]};
                renderDetails(`acts.c.${id}`, "modify");
                break;
            }
            case "achi": {
                const id = Number(SEARCHC_NAME.value);
                if (!Number.isInteger(id)) return;
                writeData.achi.create[id] = {id,name:"",display:{comb:0,fmts:[],values:{}},granting:{acts:"",prereqs:{comb:0,sub:[]},init:null},evo:[],population:0n};
                renderDetails(`achi.c.${id}`, "modify");
                break;
            }
        }
    };
    SEARCHC_NAME.oninput = () => {
        SEARCHC_BUTTON.disabled = SEARCHC_NAME.value.length === 0;
    };

    IDCA_DELETE.onclick = () => {
        const type = typeof curr_detail_data.id === "string" ? "acts" : "achi";
        origData[type][curr_detail_data.id] = curr_detail_data;
        writeData[type].delete.add(curr_detail_data.id);
        stagedIds[type].add(curr_detail_data.id);
        renderDetails(undefined);
    };
    IDCA_EDIT.onclick = () => {
        const type = typeof curr_detail_data.id === "string" ? "acts" : "achi";
        if (typeof curr_detail_id === "number") {
            writeData[type].update[curr_detail_data.id] = curr_detail_data;
            renderDetails(`${type}.u.${curr_detail_data.id}`, "modify");
        } else {
            renderDetails(curr_detail_id, "modify");
        }
    };
    IDCA_STAGE.onclick = () => {
        const type = typeof curr_detail_data.id === "string" ? "acts" : "achi";
        stagedIds[type].add(curr_detail_data.id);
        const t = curr_detail_id[curr_detail_id.indexOf(".")+1];
        const place = t === "c" ? "create" : "update";
        const $ = DETAILS_PANE.querySelector;
        if (type === "acts") {
            if (curr_detail_data.id[0] === "+") {
                /**@type {Action} */
                const info = {id:curr_detail_data.id,perm:[],data:curr_detail_data.data};
                $("#det-act-tperms").childNodes.forEach(v => {info.perm.push(readTriggerPerms(v));});
                writeData[type][place][curr_detail_data.id] = info;
                renderDetails(curr_detail_id, "review-mod");
            } else {
                // agrp
            }
        } else {
            alert("TODO: staging achievements");
        }
    };
    IDCA_CANCEL.onclick = () => {
        const type = typeof curr_detail_data.id === "string" ? "acts" : "achi";
        stagedIds[type].delete(curr_detail_data.id);
        const t = curr_detail_id[curr_detail_id.indexOf(".")+1];
        if (t === "c") {
            delete writeData[type].create[curr_detail_data.id];
        } else if (t === "u") {
            delete writeData[type].update[curr_detail_data.id];
        } else {
            writeData[type].delete.delete(curr_detail_data.id);
            delete origData[type][curr_detail_data.id];
        }
    };


    function doSearch() {
        const params = new URLSearchParams();
        params.append("kind", query_data.kind);
        if (query_data.search) {
            params.append("search", query_data.search);
        }
        params.append("page", query_data.page);
        search_request_lock = true;
        fetch(`https://${document.location.hostname}/acc/admin/achievements?${params}`, {method:"GET"}).then(async r => {
            if (r.ok) {
                query_data.resp = await r.json();
                renderSearchResults();
            } else {
                alert(`error (${r.status}): ${await r.text()}`);
            }
        }).finally(() => {
            search_request_lock = false;
        });
    }

    /**
     * @param {number|string} item if string, must be of the form {type}.{op}.{id}
     * @param {"view"|"modify"|"review"|"review-mod"} mode defaults to "view"
     * @description
     * mode:
     * - view -- readonly, allows 'edit' and 'delete'
     * - modify -- allows changes to be made, allows 'cancel' and 'stage'
     * - review -- allows staged changes to be reviewed, allows 'cancel'
     * - review-mod -- allows staged changes to be reviewed, allows 'cancel' and 'edit'
     */
    function renderDetails(item, mode) {
        if (item === undefined) {
            DETAILS_PANE.switchPanel("blank");
            curr_detail_id = null;
            curr_detail_data = null;
            return;
        }
        mode = mode || "view";
        /**@type {ActionLike|AchiDef} */
        const data = typeof item === "number" ? query_data.resp.list[item] : (()=>{
            const i = item.indexOf(".");
            const t = item[i+1]; // operation type
            const n = item.slice(i+3); // name/key
            const d = item.slice(0,i); // domain (acts, achi)
            if (t === "c" || t === "u") return writeData[d].create[n];
            if (t === "d") return origData[d][n];
            return undefined;
        })();
        if (!data) {
            // the specified item does not exist
            DETAILS_PANE.switchPanel("error");
            // activePanel.hidden = true;
            // activePanel = ERROR_DETAILS;
            // ERROR_DETAILS.hidden = false;
            document.getElementById("det-err-type").textContent = "Invalid Details Target";
            document.getElementById("det-err-info").replaceChildren(`The requested detail's identifier (${item}) did not resolve to an acceptable object.`,make("br"),(()=>{
                if (typeof item==="number")return `Search results length is ${query_data.resp.list.length}.`;
                const i = item.indexOf(".");
                const d = item.slice(0,i);
                const t = item[i+1];
                const n = item.slice(i+3);
                if (!["c","u","d"].includes(t))return `Invalid operation type (${t}).`;
                if (!(d in writeData))return `Invalid domain (${d}).`;
                if (t==="d")return `Orig data includes key (${n in origData[d]}).`;
                return `Write data includes key (${n in writeData[d][t==='c'?"create":"update"]})`;
            })());
            curr_detail_data = null;
            curr_detail_id = null;
            curr_detail_mode = "view";
            return;
        }
        curr_detail_id = item;
        curr_detail_data = data;
        curr_detail_mode = mode;
        switch (mode) {
            case "modify": {
                IDCA_DELETE.hidden = true;
                IDCA_EDIT.hidden = true;
                break;
            }
            case "review": {
                IDCA_DELETE.hidden = true;
                IDCA_EDIT.hidden = true;
                IDCA_STAGE.hidden = true;
                break;
            }
            case "review-mod": {
                IDCA_DELETE.hidden = true;
                IDCA_STAGE.hidden = true;
                break;
            }
            case "view": {
                IDCA_CANCEL.hidden = true;
                IDCA_STAGE.hidden = true;
                break;
            }
        }
        // activePanel.hidden = true;
        if (typeof data.id === "string") {
            if (data.id[0] === "+") {
                /**@type {Action} */
                const info = data;
                // activePanel = ACTION_DETAILS;
                // ACTION_DETAILS.hidden = false;
                DETAILS_PANE.switchPanel("action");
                const $ = DETAILS_PANE.querySelector;
                $("#det-act-tperms-set").disabled = mode !== "modify";
                $("#det-act-id").value = info.id.slice(1);
                /**@type {HTMLTableSectionElement} */
                const permslist = $("#det-act-tperms");
                permslist.replaceChildren();
                for (const pset of info.perm) {
                    permslist.appendChild(createTriggerPerms(pset));
                }
                $("#det-act-tperms-lcol").children[0].onclick = () => {console.log("click");};
            } else {
                /**@type {ActionGroup} */
                const info = data;
                // activePanel = AGROUP_DETAILS;
                // AGROUP_DETAILS.hidden = false;
                DETAILS_PANE.switchPanel("agroup")
                const $ = DETAILS_PANE.querySelector;
                $("#det-grp-id").value = info.id.slice(1);
            }
        } else {
            /**@type {AchiDef} */
            const info = data;
            // activePanel = ACHIEVE_DETAILS;
            // ACHIEVE_DETAILS.hidden = false;
            DETAILS_PANE.switchPanel("achieve");
            const $ = DETAILS_PANE.querySelector;
        }
    }
    /**
     * @param {number?} p
     * @returns {HTMLTableRowElement}
     */
    function createTriggerPerms(p) {
        const f = numberToField(p||0);
        const r = document.createElement("tr");
        for (let i = 0; i < 32; i ++) {
            const c = make("input",{"type":"checkbox"});
            c.checked = f[i];
            c.bit = i;
            r.appendChild(make("td",{"children":[make("span",{"children":[c]})]}));
        }
        r.appendChild(make("td",{"children":[make("span",{"children":[
            make("input",{"type":"button","value":"-","onclick":()=>{r.parentElement.removeChild(r);}})
        ]})]}));
        return r;
    }
    /**
     * @param {HTMLTableRowElement} p
     * @returns {number}
     */
    function readTriggerPerms(p) {
        const l = new Array(32).fill(false);
        for (let i = 0; i < 32; i ++) {
            l[i] = p.children[i].querySelector("input").checked;
        }
        return fieldToNumber(l);
    }
    function renderSearchResults() {
        const children = [];
        switch (query_data.kind) {
            case "achi": {
                for (let i = 0, l = query_data.resp.list.length; i < l; i ++) {
                    const res = query_data.resp.list[i];
                    children.push(make("div", {"classList":["sr-item"],"onclick":()=>{if(curr_detail_mode!=="view")return;renderDetails(i);},"children":[
                        make("span", {"classList":["sr-type"],"textContent":"Achievement"}),
                        " ",
                        make("span", {"textContent":res.name})
                    ]}));
                }
                break;
            }
            case "acts": {
                for (let i = 0, l = query_data.resp.list.length; i < l; i ++) {
                    const res = query_data.resp.list[i];
                    children.push(make("div", {"classList":["sr-item"],"onclick":()=>{renderDetails(i);},"children":[
                        make("span", {"classList":["sr-type"],"textContent":res.id[0]==="+"?"Action":"Action Group"}),
                        " ",
                        make("span", {"textContent":res.id.slice(1)})
                    ]}));
                }
                break;
            }
        }
        PAGE_COUNT.textContent = query_data.resp.count;
        PAGE_INPUT.value = query_data.page;
        PAGE_INPUT.max = query_data.resp.count;
        SEARCH_KIND.value = query_data.kind;
        SEARCH_NAME.value = query_data.search;
        SEARCH_RESULTS.replaceChildren(...children);
    }
    function renderStagedChanges() {
        /**@type {HTMLDivElement[]} */
        const cards = [];
        /**
         * adds the card to the cards list
         * @param {"create"|"update"|"delete"} operation
         * @param {"achi"|"acts"} type
         * @param {string} id
         * @param {string?} details
         * @returns {void}
         */
        const createCard = (operation, type, id, details) => {
            const cont = make("div", {"classList":["sr-item"],"onclick":()=>{renderDetails(`${type}.${operation[0]}.${id}`)}});
            const opchar = {"create":"C","update":"U","delete":"D"}[operation];
            cont.appendChild(make("span", {"classList":["sr-type"],"textContent":`(${opchar})`}));
            let name;
            switch (type) {
                case "achi": {
                    name = make("span", {"children":[
                        make("span", {"classList":["sr-type"],"textContent":"Achievement"}),
                        " ",
                        make("span", {"textContent":id})
                    ]});
                    break;
                }
                case "acts": {
                    name = make("span", {"children":[
                        make("span", {"classList":["sr-type"],"textContent":id[0]==="+"?"Action":"Action Group"}),
                        " ",
                        make("span", {"textContent":id.slice(1)})
                    ]});
                    break;
                }
            }
            cont.appendChild(name);
            if (details) {
                cont.append(details);
            }
            cards.push(cont);
        };
        /**@type {["create","update","delete"]} */
        const ops = ["create","update","delete"];
        for (const operation of ops) {
            if (operation === "delete") {
                for (const change of writeData.acts[operation].sort()) {
                    createCard(operation,"acts",change,null);
                }
                for (const change of writeData.achi[operation].sort()) {
                    createCard(operation,"achi",change,null);
                }
            } else {
                for (const change of Object.keys(writeData.acts[operation]).sort()) {
                    createCard(operation,"acts",change.id,null);
                }
                for (const change of Object.keys(writeData.achi[operation]).sort()) {
                    createCard(operation,"achi",change.name,null);
                }
            }
        }
        STAGED_LIST.replaceChildren(...cards);
    }

    function populateTPerms() {
        /**@type {HTMLTableSectionElement} */
        const head = document.getElementById("det-act-tperms-outer").children[0];
        for (let i = 0; i < 32; i ++) {
            head.appendChild(make("th",{"textContent":(i in perms.SHORT_PRIVS)?perms.SHORT_PRIVS[i]:`Bit ${i+1}`}));
        }
        head.appendChild(make("th",{"children":[make("input",{"type":"button","value":"New"})],"id":"det-act-tperms-lcol"}));
    }
    _ACHIEVEMENTS_DEBUG_DO = (thing) => {
        return eval(thing);
    };
})();