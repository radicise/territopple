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
document.addEventListener("load", () => {PAGE_INPUT.value = 1;});
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
                renderResults();
            } else {
                alert(`error (${r.status}): ${await r.text()}`);
            }
        }).finally(() => {
            search_request_lock = false;
        });
    }

    /**
     * @param {number} item
     */
    function renderDetails(item) {}
    function renderResults() {
        const children = [];
        switch (query_data.kind) {
            case "achi": {
                for (let i = 0, l = query_data.resp.list.length; i < l; i ++) {
                    const res = query_data.resp.list[i];
                    const c = document.createElement("div");
                    c.onclick = () => {renderDetails(i);};
                    c.classList.add("sr-item");
                    const type = document.createElement("span");
                    type.classList.add("sr-type");
                    type.textContent = "Achievement";
                    c.appendChild(type);
                    c.append(" ");
                    const name = document.createElement("span");
                    name.textContent = res.name;
                    c.appendChild(name);
                    children.push(c);
                }
                break;
            }
            case "acts": {
                for (let i = 0, l = query_data.resp.list.length; i < l; i ++) {
                    const res = query_data.resp.list[i];
                    const c = document.createElement("div");
                    c.onclick = () => {renderDetails(i);};
                    c.classList.add("sr-item");
                    const type = document.createElement("span");
                    type.classList.add("sr-type");
                    type.textContent = res.id[0] === "+" ? "Action" : "Action Group";
                    c.appendChild(type);
                    c.append(" ");
                    const name = document.createElement("span");
                    name.textContent = res.id.slice(1);
                    c.appendChild(name);
                    children.push(c);
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
})();