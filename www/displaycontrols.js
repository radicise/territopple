/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");

slider.addEventListener("input", () => {
    container.style.setProperty("--tile-font-size", slider.value);
});
// document.addEventListener("keydown", (e) => {
//     switch (e.code) {
//     case "Minus":
//         let zoom = Math.min(Math.max(parseInt(container.style.getProperty("--tile-font-size")) - 1, 10), 100);
//         container.style.setProperty("--tile-font-size", zoom);
//         slider.value = zoom;
//         break;
//     case "Equal":
//         let zoom = Math.min(Math.max(parseInt(container.style.getProperty("--tile-font-size")) + 1, 10), 100);
//         container.style.setProperty("--tile-font-size", zoom);
//         slider.value = zoom;
//         break;
//     }
// });
