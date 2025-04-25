/**@type {HTMLTableSectionElement} */
const joinedList = document.getElementById("joined-list");

/**
 * @param {HTMLElement|string|number|boolean|bigint|object} content
 * @returns {HTMLTableCellElement}
 */
function makeTD(content) {
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
                createBanner({type:"info",content:"Ping is not available yet"});
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

/**
 * @param {number|string} n
 */
function addJListSelf(n) {
    const row = document.createElement("tr");
    row.scope = "row";
    row.id = `JLIST-player-${n}`;
    row.append(makeTD(`${n} (self)`));
    row.append(makeTD(typeof n === "number" ? (n === game.hostNum ? "Host" : "Player") : "Spectator"));
    // row.append(...makeJListActions("self"));
    row.append(makeTD("--:--"));
    row.append(makeJListActions("self"));
    joinedList.append(row);
}
/**
 * @param {number} n
 */
function addJListPlayer(n) {
    const row = document.createElement("tr");
    row.scope = "row";
    row.id = `JLIST-player-${n}`;
    row.append(makeTD(n));
    row.append(makeTD(n === game.hostNum ? "Host" : "Player"));
    row.append(makeTD("--:--"));
    // row.append(...makeJListActions("player", n));
    row.append(makeJListActions("player", n));
    joinedList.append(row);
    rescanHostOnly();
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
 * @param {string} n
 */
function addJListSpectator(n) {
    const row = document.createElement("tr");
    row.id = `JLIST-spectator-${n}`;
    row.scope = "row";
    row.append(makeTD(n));
    row.append(makeTD("Spectator"));
    row.append(makeTD(""));
    // row.append(...makeJListActions("spectator", n));
    row.append(makeJListActions("spectator", n));
    // const lspecs = joinedList.querySelectorAll(".spectator");
    joinedList.append(row);
    rescanHostOnly();
}
/**
 * @param {string} n
 */
function removeJListSpectator(n) {
    const c = document.getElementById(`JLIST-spectator-${n}`);
    if (!c) return;
    joinedList.removeChild(c);
}

function setJListTime(n, v) {
    const c = document.getElementById(`JLIST-player-${n}`);
    if (!c) return;
    c.children[2].textContent = formatTimer(v);
}

function formatTimer(v) {
    return v===null?"--:--":`${Math.floor(v/60).toLocaleString({},{"minimumIntegerDigits":2})}:${(v%60).toLocaleString({},{"minimumIntegerDigits":2})}`;
}
