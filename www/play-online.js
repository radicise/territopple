let table = document.getElementById("roomRows");
let host = document.location.hostname;
if (sessionStorage.getItem("error-store")) {
    document.getElementById("error-popup-text").textContent = sessionStorage.getItem("error-store");
    document.getElementById("error-popup").hidden = false;
    sessionStorage.removeItem("error-store");
}
window.addEventListener("pageshow", () => {
    sessionStorage.removeItem("rejoin_key");
    sessionStorage.removeItem("rejoin_g");
    sessionStorage.removeItem("rejoin_p");
});
function displayRooms(text) {
    table.replaceChildren();
    /**@type {{ident:string,capacity:number,playing:number,spectating:number,dstr:string,can_spectate:boolean,phase:"wait"|"play"|"over",res:boolean}[]} */
    const games = JSON.parse(text);
    for (const game of games) {
        if (!game) {
            continue;
        }

        // const identifier = properties[0];
        // const width      = properties[1];
        // const height     = properties[2];
        // const status     = properties[3];
        // const observers  = properties[4];
        // const players    = properties[5];
        // const capacity   = properties[6];

        const row = document.createElement("tr");
        row.scope = "row";

                const link = document.createElement("a");
                link.textContent = game.ident;
                // link.appendChild(document.createTextNode(game.ident));
                link.href = `http://${document.location.host}/territopple?t=0&g=${game.ident}`+(game.res?"&res=1":"");

        const roomEntry = document.createElement("td");
        roomEntry.appendChild(link);
        row.appendChild(roomEntry);

        const sizeEntry = document.createElement("td");
        sizeEntry.appendChild(document.createTextNode(game.dstr));
        row.appendChild(sizeEntry);
        
        const statusEntry = document.createElement("td");
        // statusEntry.appendChild(document.createTextNode(false ? "In progress" : "Waiting for players"));
        statusEntry.appendChild(document.createTextNode(game.phase==="play" ? "In progress" : (game.phase==="wait"?"Waiting for players":"Finished")));
        row.appendChild(statusEntry);
        
        const playerEntry = document.createElement("td");
        playerEntry.appendChild(document.createTextNode(game.playing));
        row.appendChild(playerEntry);
        
        const capacityEntry = document.createElement("td");
        capacityEntry.appendChild(document.createTextNode(game.capacity));
        row.appendChild(capacityEntry);

        const spectatingEntry = document.createElement("td");
        spectatingEntry.appendChild(document.createTextNode(game.spectating));
        row.append(spectatingEntry);

        const sLinkEntry = document.createElement("td");
        let spectateLink = document.createElement("a");
        if (game.can_spectate) {
            const sp = document.createElement("span");
            spectateLink.textContent = "spectate";
            spectateLink.href = `http://${document.location.host}/territopple.html?t=4&g=${game.ident}`;
            sp.append("(");
            sp.append(spectateLink);
            sp.append(")");
            spectateLink = sp;
        } else {
            spectateLink = document.createElement("span");
            spectateLink.textContent = "(disabled)";
        }
        sLinkEntry.appendChild(spectateLink);
        row.append(sLinkEntry);

        table.appendChild(row);
    }
    if (roomRows.children.length) {
        document.getElementById("fetchingMessage").hidden = true;
        document.getElementById("roomTable").removeAttribute("hidden");
    } else {
        document.getElementById("fetchingMessage").innerText = "No public rooms";
    }

    console.log("Public rooms fetched");
}
/**
 * @param {number} [page=1]
 * @param {object?} filter
 */
function fetchRooms(page, filter) {
    document.getElementById("roomTable").hidden = true;
    document.getElementById("fetchingMessage").hidden = false;
    document.getElementById("fetchingMessage").textContent = "Fetching rooms...";
    fetch(`https://${host}/serverlist?page=${page||1}${formatFilter(filter)}`, {method:"GET"})
    .then((response) => {
        if (response.body === null) {
            console.log("Null response body");
            return;
        }
        response.text().then((text) => {
            displayRooms(text);
        });
    });
}
/**
 * @param {string} filter
 * @returns {{}}
 */
function parseFilter(filter) {
    if (!filter) return true;
    let f = {};
    filter.split(";").map(sf => sf.split(":").map(
        (v, i, a) => i===0?v:(
            (a[0]==="full"||a[0]==="spectate")?v==="true"
            :(a[0]==="phase"?v
            :(a[0]==="capacity"?(v.includes(",")?v.split(",").map(w=>Number(w)):Number(v))
            :(v.split(",").map(w => w.split(".").map((x, j) =>
                j===0?x
                :(x.includes("q")?x.split("q").map(y => Number(y)):Number(x))))))))
    )).forEach(v => f[v[0]]=v[1]);
    return f;
}
/**
 * @param {{}} filter
 * @returns {string}
 */
function formatFilter(filter) {
    if (!filter) {
        return "";
    }
    let f = [];
    for (const k in filter) {
        switch (k) {
            case"full":case"spectate":case"phase":f.push(`${k}:${filter[k]}`);break;
            case"capacity":{
                if (typeof filter.capacity === "number") {
                    f.push(`${k}:${filter.capacity}`);
                    break;
                }
                f.push(`${k}:${filter.capacity.join(",")}`);
                break;
            }
            case"topo":{
                f.push(`${k}:${filter[k].map(v => typeof v === "string" ? v : [v[0], ...v.slice(1).map(w => typeof w === "number" ? String(w) : w.join("q"))].join(".")).join(",")}`);
            }
            default:break;
        }
    }
    return "&filter="+f.join(";");
}
fetchRooms();
// fetch(`http://${host}/serverlist`,
// // fetch(`http://${host}:${game_port}/serverlist`,
//       {
//           method: "GET",
//       })
//     .then((response) => {
//         if (response.body === null) {
//             console.log("Null response body");
//             return;
//         }
// 	response.text().then((text) => {
//         displayRooms(text);
// 	});
// });
