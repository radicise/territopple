let table = document.getElementById("roomRows");
let host = document.location.hostname;
fetch(`http://${host}:${game_port}/serverlist`,
      {
          method: "GET",
      })
    .then((response) => {
    	if (response.body === null) {
		console.log("Null response body");
		return;
	}
	response.text().then((text) => {
        /**@type {{ident:string,capacity:number,playing:number,spectating:number,width:number,height:number}[]} */
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
                    link.href = `http://${document.location.host}/territopple.html?t=0&g=${game.ident}`;

		    const roomEntry = document.createElement("td");
		    roomEntry.appendChild(link);
		    row.appendChild(roomEntry);

		    const sizeEntry = document.createElement("td");
		    sizeEntry.appendChild(document.createTextNode(`${game.width}x${game.height}`));
		    row.appendChild(sizeEntry);
		    
		    const statusEntry = document.createElement("td");
		    statusEntry.appendChild(document.createTextNode(false ? "In progress" : "Waiting for players"));
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

            const spectateLink = document.createElement("a");
            spectateLink.textContent = "(spectate)";
            spectateLink.href = `http://${document.location.host}/territopple.html?t=4&g=${game.ident}`;
            const sLinkEntry = document.createElement("td");
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
	});
});
