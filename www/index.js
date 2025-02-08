let table = document.getElementById("roomRows");
let host = document.location.hostname;

fetch(`http://${host}:8302/serverlist`,
      {
          method: "POST",
          body: ""
      })
    .then((response) => {
        response.split(";").forEach((game) => {
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

            const roomEntry = document.createElement("td");
            roomEntry.appendChild(document.createTextNode(identifier));
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
        });

        document.getElementById("fetchingMessage").hidden = true;
        document.getElementById("roomTable").removeAttribute("hidden");

        console.log("Public rooms fetched");
    });
