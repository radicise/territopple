/**@type {HTMLTableSectionElement} */
const joinedList = document.getElementById("joined-list");

/**
 * @param {HTMLElement|string|number|boolean|bigint|object} content
 * @param {string[]?} classList
 * @returns {HTMLTableCellElement}
 */
function makeTD(content, classList) {
    const td = document.createElement("td");
    td.scope = "col";
    if (typeof content === "object") {
        try {
            td.appendChild(content);
        } catch {
            td.textContent = `${content}`;
        }
    } else {
        td.textContent = `${content}`;
    }
    if (classList) {
        td.classList.add(...classList);
    }
    return td;
}

/**
 * @param {string} value
 * @returns {HTMLInputElement}
 */
function makeButton(value) {
    const b = document.createElement("input");
    b.type = "button";
    b.value = value;
    return b;
}

/**
 * @param {"self"|"player"|"spectator"} type
 * @param {any} arg
 * @returns {HTMLElement[]}
 */
function makeJListActions(type, arg) {
    const td = document.createElement("td");
    td.scope = "col";
    td.append(...(()=>{
    switch (type) {
        case "self":{
            return [];
        }
        case "player":{
            // const b1 = document.createElement("input");
            // b1.type = "button";
            // b1.value = "kick";
            const b1 = makeButton("kick");
            b1.classList.add("FLAG-host-only");
            b1.onclick = () => {
                kickPlayer(arg);
            };
            // const b2 = document.createElement("input");
            // b2.type = "button";
            // b2.value = "promote";
            const b2 = makeButton("promote");
            b2.classList.add("FLAG-host-only");
            b2.onclick = () => {
                promotePlayer(arg);
            };
            // const b3 = document.createElement("input");
            // b3.type = "button";
            const b3 = makeButton("ping");
            b3.onclick = () => {
                pingPlayer(arg);
            };
            return [b1,b2,b3];
        }
        case "spectator":{
            const b1 = makeButton("kick");
            b1.classList.add("FLAG-host-only");
            b1.onclick = () => {
                kickSpectator(arg);
            }
            return [b1];
        }
    }
    })());
    return td;
}

function makeJListAvatar(n) {
    const cont = document.createElement("span");
    const img = document.createElement("img");
    cont.appendChild(img);
    img.classList.add("pfp-img");
    if (typeof n === "object") {
        if (n.length === 3) {
            if (n[2]) {
                img.src = `/acc/pfp/get/${n[2]}`;
            }
        } else {
            if (n[1]) {
                img.src = `/acc/pfp/get/${n[1]}`;
            }
        }
    }
    if (!img.src) {
        img.src = "/acc/pfp/get/%40guest";
    }
    return makeTD(cont,["JLIST-avatar"]);
}

/**
 * @param {HTMLTableRowElement} c
 * @param {string} a
 */
function setJListAvatar(c, a) {
    c.children[0].children[0].children[0].src = `/acc/pfp/get/${a}`;
}

/**
 * @param {number} n
 * @param {string} a
 */
function setJListPlayerBot(n, a) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    c.children[1].textContent = `${n} (bot ${a}) - ${game.playerList[n].team}`;
}
/**
 * @param {number} n
 * @param {string} a
 */
function setJListPlayerAccount(n, a) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    c.children[1].textContent = `Player ${n} (${a}) - ${game.playerList[n].team}`;
    setJListAvatar(c, a);
}
/**
 * @param {string} n
 * @param {string} a
 */
function setJListSpectatorAccount(n, a) {
    const c = document.getElementById(`JLIST-spectator-${n}`);
    if (!c) return;
    c.children[1].textContent = `${n.slice(0,3)} (${a})`;
    setJListAvatar(c, a);
}
/**
 * @param {number|string} n
 * @param {string} a
 */
function setJListSelfAccount(n, a) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    let id;
    if (typeof n === "number") {
        id = `Player ${n}`;
    } else {
        id = `${n.slice(0,3)}`;
    }
    c.children[1].textContent = `${id} (${a}) [self]`;
    setJListAvatar(c, a);
}

/**
 * @param {number|string} n
 */
function addJListSelf(n) {
    const row = document.createElement("tr");
    row.scope = "row";
    row.id = `JLIST-player-${n}`;
    row.append(makeJListAvatar(n));
    row.append(makeTD(`${n} (Guest) [self]`, ["JLIST-id"]));
    row.append(makeTD(typeof n === "number" ? (n === game.hostNum ? "Host" : "Player") : "Spectator"));
    // row.append(...makeJListActions("self"));
    row.append(makeTD("--:--"));
    row.append(makeTD("-"));
    row.append(makeJListActions("self"));
    joinedList.append(row);
}
/**
 * @param {[number,number,string|null]} n
 */
function addJListPlayer(n) {
    const row = document.createElement("tr");
    row.scope = "row";
    row.id = `JLIST-player-${n[0]}`;
    row.append(makeJListAvatar(n));
    row.append(makeTD(`${n[0]} (${n[2]??"Guest"}) - ${n[1]}`, ["JLIST-id"]));
    row.append(makeTD(n === game.hostNum ? "Host" : "Player"));
    row.append(makeTD("--:--"));
    row.append(makeTD("-"));
    // row.append(...makeJListActions("player", n));
    row.append(makeJListActions("player", n[0]));
    joinedList.append(row);
    rescanHostOnly();
    if (n[2]) {
        setJListPlayerAccount(n[0], n[2]);
    }
}
/**
 * @param {number} n
 */
function removeJListPlayer(n) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    joinedList.removeChild(c);
}
/**
 * @param {[string,string|null]} n
 */
function addJListSpectator(n) {
    const row = document.createElement("tr");
    row.id = `JLIST-spectator-${n[0]}`;
    row.scope = "row";
    row.append(makeJListAvatar(n));
    row.append(makeTD(`${n[0].slice(0,3)} (${n[1]??"Guest"})`, ["JLIST-id"]));
    row.append(makeTD("Spectator"));
    row.append(makeTD(""));
    row.append(makeTD(""));
    // row.append(...makeJListActions("spectator", n));
    row.append(makeJListActions("spectator", n[0]));
    // const lspecs = joinedList.querySelectorAll(".spectator");
    joinedList.append(row);
    rescanHostOnly();
    if (n[1]) {
        setJListSpectatorAccount(n[0], n[1]);
    }
}
/**
 * @param {string} n
 */
function removeJListSpectator(n) {
    const c = document.getElementById(`JLIST-spectator-${n}`);
    if (!c) return;
    joinedList.removeChild(c);
}

/**
 * @param {number} n
 * @param {number} v
 */
function setJListTime(n, v) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    c.children[3].textContent = formatTimer(v);
}
/**
 * @param {number} n
 * @param {number|null} v
 */
function setJListScore(n, v) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    c.children[4].textContent = v??"-";
}

function formatTimer(v) {
    return v===null?"--:--":`${Math.floor(v/60).toLocaleString({},{"minimumIntegerDigits":2})}:${(v%60).toLocaleString({},{"minimumIntegerDigits":2})}`;
}
