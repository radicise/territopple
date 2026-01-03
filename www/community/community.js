
/**@type {HTMLTableSectionElement} */
const listTable = document.getElementById("member-list").children[1];
/**@type {HTMLInputElement} */
const searchText = document.getElementById("search-entry");
/**@type {HTMLInputElement} */
const searchButton = document.getElementById("search-button");

/**
 * @param {MouseEvent} ev
 * @param {string} id
 */
async function addFriend(ev, id) {
    const res = await fetch(`https://${document.location.hostname}/acc/send-friend-request`, {headers:[["content-type","application/json"]],method:"POST",body:JSON.stringify({"id":id})});
    if (res.status === 200) {
        ev.target.alt = "Cancel Friend Request";
        ev.target.title = "Cancel Friend Request";
        ev.target.src = "community/icons/cancelfriend.svg";
        ev.target.onclick = (ev)=>{cancelFriendRequest(ev, id);};
    }
}
/**
 * @param {MouseEvent} ev
 * @param {string} id
 */
async function cancelFriendRequest(ev, id) {
    const res = await fetch(`https://${document.location.hostname}/acc/unfriend`, {headers:[["content-type","application/json"]],method:"POST",body:JSON.stringify({"id":id})});
    if (res.status === 200) {
        ev.target.alt = "Add Friend";
        ev.target.title = "Add Friend";
        ev.target.src = "community/icons/addfriend.svg";
        ev.target.onclick = (ev)=>{addFriend(ev, id);};
    }
}
/**
 * @param {MouseEvent} ev
 * @param {string} id
 */
async function acceptFriendRequest(ev, id) {
    const res = await fetch(`https://${document.location.hostname}/acc/send-friend-request`, {headers:[["content-type","application/json"]],method:"POST",body:JSON.stringify({"id":id})});
    if (res.status === 200) {
        ev.target.alt = "Unfriend";
        ev.target.title = "Unfriend";
        ev.target.src = "community/icons/acceptfriend.svg";
        ev.target.onclick = (ev)=>{unFriend(ev, id);};
    }
}
/**
 * @param {MouseEvent} ev
 * @param {string} id
 */
async function unFriend(ev, id) {
    const res = await fetch(`https://${document.location.hostname}/acc/unfriend`, {headers:[["content-type","application/json"]],method:"POST",body:JSON.stringify({"id":id})});
    if (res.status === 200) {
        ev.target.alt = "Add Friend";
        ev.target.title = "Add Friend";
        ev.target.src = "community/icons/addfriend.svg";
        ev.target.onclick = (ev)=>{addFriend(ev, id);};
    }
}

/**
 * @param {string} id
 * @param {0|1|2|3} friend
 * @returns {HTMLElement[]}
 */
function makeFriendActions(id, friend) {
    const actions = [];
    switch (friend) {
        case 0: {
            actions.push(make("input",{"type":"image","alt":"Add Friend","title":"Add Friend","src":"community/icons/addfriend.svg","onclick":(ev)=>{addFriend(ev, id);}}));
            break;
        }
        case 1: {
            actions.push(make("input",{"type":"image","alt":"Cancel Friend Request","title":"Cancel Friend Request","src":"community/icons/cancelfriend.svg","onclick":(ev)=>{cancelFriendRequest(ev, id);}}));
            break;
        }
        case 2: {
            actions.push(make("input",{"type":"image","alt":"Accept Friend Request","title":"Accept Friend Request","src":"community/icons/acceptfriend.svg","onclick":(ev)=>{acceptFriendRequest(ev, id);}}));
            break;
        }
        case 3: {
            actions.push(make("input",{"type":"image","alt":"Unfriend","title":"Unfriend","src":"community/icons/unfriend.svg","onclick":(ev)=>{unFriend(ev, id);}}));
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
        row.replaceChildren(...make([["td",{textContent:entry.id}],["td",{textContent:entry.name}],["td",{textContent:entry.level.toString()}],["td",{textContent:(new Date(entry.odate)).toLocaleDateString()}],["td",{textContent:(new Date(entry.cdate)).toLocaleDateString()}],["td",{children:[make("span", {children:makeFriendActions(entry.id, entry.friend),classList:["flex-center"]})]}]]));
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
