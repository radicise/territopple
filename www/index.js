let table = document.getElementById("roomRows");
let host = document.location.hostname;
fetch(`http://${host}:8302/serverlist`,
      {
          method: "GET",
      })
    .then((response) => {
    	if (response.body === null) {
		console.log("Null response body");
		return;
	}
	response.text().then((text) => {
	    for (const game of text.split(";")) {
		    if (game === "") {
			continue;
		    }
		    const properties = game.split("_");

		    const identifier = properties[0];
		    const width      = properties[1];
		    const height     = properties[2];
		    const status     = properties[3];
		    const observers  = properties[4];
		    const players    = properties[5];
		    const capacity   = properties[6];

		    const row = document.createElement("tr");
		    row.scope = "row";

                    const link = document.createElement("a");
                    link.appendChild(document.createTextNode(identifier));
                    link.href = `http://${document.location.host}/territopple.html?t=0&g=${identifier}&w=${width}&h=${height}&p=${capacity}`;

		    const roomEntry = document.createElement("td");
		    roomEntry.appendChild(link);
		    row.appendChild(roomEntry);

		    const sizeEntry = document.createElement("td");
		    sizeEntry.appendChild(document.createTextNode(`${width}x${height}`));
		    row.appendChild(sizeEntry);
		    
		    const statusEntry = document.createElement("td");
		    statusEntry.appendChild(document.createTextNode(status == "1" ? "Waiting for players" : "In progress"));
		    row.appendChild(statusEntry);
		    
		    const playerEntry = document.createElement("td");
		    playerEntry.appendChild(document.createTextNode(players));
		    row.appendChild(playerEntry);
		    
		    const capacityEntry = document.createElement("td");
		    capacityEntry.appendChild(document.createTextNode(capacity));
		    row.appendChild(capacityEntry);

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
