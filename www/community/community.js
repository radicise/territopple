
/**@type {HTMLTableSectionElement} */
const listTable = document.getElementById("member-list").children[1];
/**@type {HTMLInputElement} */
const searchText = document.getElementById("search-entry");
/**@type {HTMLInputElement} */
const searchButton = document.getElementById("search-button");

/**
 * @type {{
 * (nodename:"td",attrs:{textContent:string}): HTMLTableCellElement;
 * (nodename:"td",attrs:{children:HTMLElement[]}): HTMLTableCellElement;
 * (nodename:"td"): HTMLTableCellElement;
 * (): void;
 * (nodename:"span",attrs:{textContent:string?,id:string?,classList:string[]?}): HTMLSpanElement;
 * (nodename:"span",attrs:{children:HTMLElement[],id:string?,classList:string[]?}): HTMLSpanElement;
 * (nodename:"span"): HTMLSpanElement;
 * (): void;
 * (nodename:"input",attrs:{type:"button",id:string?,value:string,onclick:VoidFunction?}): HTMLInputElement;
 * (nodename:"input",attrs:{type:"text",id:string?,placeholder:string?}): HTMLInputElement;
 * (nodename:"input",attrs:{type:"email",id:string?,placeholder:string?}): HTMLInputElement;
 * (nodename:"input",attrs:{type:"password",id:string?}): HTMLInputElement;
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]>): HTMLTableCellElement[];
 * (nodename:Array<["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]>): HTMLSpanElement[];
 * (nodename:Array<["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): HTMLInputElement[];
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]>): Array<HTMLTableCellElement|HTMLSpanElement>;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLTableCellElement|HTMLInputElement>;
 * (nodename:Array<["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLSpanElement|HTMLInputElement>;
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLTableCellElement|HTMLSpanElement|HTMLInputElement>;
 * }}
 * @\type {{
 * (nodename:"td",attrs:{textContent:string?}|{children:HTMLElement[]?}|null): HTMLTableCellElement;
 * (nodename:"span",attrs:{textContent:string?,id:string?,classList:string[]?}|{children:HTMLElement[]?,id:string?,classList:string[]?}|null): HTMLSpanElement;
 * (nodename:"input",attrs:{type:"button",value:string?,id:string?}|{type:"text",placeholder:string?,id:string?}|{type:"email",id:string?}|{type:"password",id:string?}): HTMLInputElement;
 * (nodename:Array<
 * ["td",{textContent:string?}|{children:HTMLElement[]?}|null]|
 * ["span",{textContent:string?,id:string?,classList:string[]?}|{children:HTMLElement[]?,id:string?,classList:string[]?}|null]|
 * ["input",{type:"button",value:string?,id:string?}|{type:"text",placeholder:string?,id:string?}|{type:"email",id:string?}|{type:"password",id:string?}]
 * >): Array<HTMLTableCellElement|HTMLSpanElement|HTMLInputElement>;
 * }}
 */
const make = (nodename, attrs) => {
    if (Array.isArray(nodename)) {
        return nodename.map(v => make(v[0], v[1]));
    }
    const e = document.createElement(nodename);
    if (attrs?.textContent) {
        e.textContent = attrs.textContent;
    }
    if (attrs?.id) {
        e.id = attrs.id;
    }
    if (attrs?.classList) {
        e.classList.add(...attrs.classList);
    }
    if (attrs?.type) {
        e.type = attrs.type;
    }
    if (attrs?.value) {
        e.value = attrs.value;
    }
    if (attrs?.placeholder) {
        e.placeholder = attrs.placeholder;
    }
    if (attrs?.onclick) {
        e.onclick = attrs.onclick;
    }
    if (attrs?.children) {
        e.replaceChildren(...attrs.children);
    }
    return e;
};

/**
 * @param {string} id
 */
async function addFriend(id) {}
/**
 * @param {string} id
 */
async function cancelFriendRequest(id) {}
/**
 * @param {string} id
 */
async function acceptFriendRequest(id) {}
/**
 * @param {string} id
 */
async function unFriend(id) {}

/**
 * @param {string} id
 * @param {0|1|2|3} friend
 * @returns {HTMLElement[]}
 */
function makeFriendActions(id, friend) {
    const actions = [];
    switch (friend) {
        case 0: {
            actions.push(make("input",{"type":"button","value":"Add Friend","onclick":()=>{addFriend(id);}}));
            break;
        }
        case 1: {
            actions.push(make("input",{"type":"button","value":"Cancel Friend Request","onclick":()=>{cancelFriendRequest(id);}}));
            break;
        }
        case 2: {
            actions.push(make("input",{"type":"button","value":"Accept Friend Request","onclick":()=>{acceptFriendRequest(id);}}));
            break;
        }
        case 3: {
            actions.push(make("input",{"type":"button","value":"Unfriend","onclick":()=>{unFriend(id);}}));
            break;
        }
    }
    return actions;
}

/**
 * @param {string} search
 * @param {number} page
 */
async function loadPage(search, page) {
    const res = await fetch(`https://${document.location.hostname}/acc/pub/list?page=${page||1}&search=${search||".*"}`);
    if (res.status !== 200) {
        return;
    }
    /**@type {{id:string,name:string,cdate:number,odate:number,level:number,friend:number}[]} */
    const data = JSON.parse(await res.text());
    const rows = [];
    for (const entry of data) {
        const row = document.createElement("tr");
        row.replaceChildren(...make([["td",{textContent:entry.id}],["td",{textContent:entry.name}],["td",{textContent:entry.level.toString()}],["td",{textContent:(new Date(entry.odate)).toLocaleDateString()}],["td",{textContent:(new Date(entry.cdate)).toLocaleDateString()}],["td",{children:makeFriendActions(entry.id, entry.friend)}]]));
        rows.push(row);
    }
    listTable.replaceChildren(...rows);
}

let page;
let search;

(async () => {
    await INCLUDE_FINISHED;
    loadPage();
    searchButton.onclick = () => {
        search = searchText.value;
        loadPage(search, page);
    };
})();
