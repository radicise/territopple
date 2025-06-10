/*
Intro:
Welcome to Territopple!
This short tutorial will teach you everything you need to know about the territory toppling game. If you ever need a quick refresher, don't forget to check out the Reference (the other option upon clicking the question mark button)

Basic Layout:
Territopple is played on a grid of tiles. Each tile will have one or more pieces on it, either belonging to a team or unclaimed.

Turns:
Players take turns in order. On their turn, each player must place a piece onto either a neutral space, or a space owned by their team.
If a player has no valid moves, they lose. Play continues until one team owns all the tiles.

Toppling:
If the number of pieces on a tile exceeds the number of neighbors that tile has, the tile will topple. Toppling resets a tile to having one piece, and adds a piece to each of its neighbors. This can cause chain reactions.
Any tile that is toppled onto will become owned by the team that just played their move.
Toppling is the only way to claim tiles that are already owned by other teams.
*/

const lines = [
    ["Welcome to Territopple!", ["This short tutorial will teach you everything you need to know about this territorry toppling game. If you ever need a quick refresher, don't forget to check out the Reference! (The other option when clicking the question mark button)"], "next", null],
    ["Basic Layout", ["Territopple is played on a grid of tiles. Each tile will have one or more pieces on it, either belonging to a team or unclaimed."], "okay", null],
    ["Turns", ["Players take turns in order. On their turn, each player must place a piece onto either a neutral space, or a space owned by their team.", "If a player has no valid moves, they lose. Play continues until one team owns all the tiles."], "got it", null],
    ["Toppling", ["If the number of pieces on a tile is greater than the number of neighbors it has, that tile will topple. Toppling resets a tile to one piece and adds a piece to each of its neighbors. This can cause chain reactions.", "Any tile that is toppled onto will become owned by the team that just played their move, so toppling is the only way to claim tiles that are already owned by other teams."], "alright", null],
    ["That's All!", ["You're ready to start playing Territopple! Don't forget to checkout the puzzle mode and other ways to play!"], "home", null]
];
let line = -1;
/**@type {HTMLDivElement} */
const box = document.getElementById("text-box");

function nextLine() {
    if (line === lines.length - 1) {
        location.pathname = "";
    }
    line ++;
    const b = document.createElement("b");
    b.textContent = lines[line][0];
    let plist = [];
    for (const pt of lines[line][1]) {
        const p = document.createElement("p");
        p.textContent = pt;
        plist.push(p);
    }
    /**@type {HTMLInputElement} */
    const p = document.createElement("input");
    p.type = "button";
    p.disabled = line <= 0;
    p.value = "back";
    p.onclick = () => {
        if (line > 0) {
            line -= 2;
            nextLine();
        }
    }
    const c = document.createElement("input");
    c.type = "button";
    c.value = lines[line][2];
    c.onclick = nextLine;
    const l = document.createElement("div");
    l.append(p, c);
    box.replaceChildren(b, ...plist, l);
}
nextLine();
