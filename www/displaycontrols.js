/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");
/**@type {HTMLDivElement} */
const extraSettings = document.getElementById("extra-display-settings");
/**@type {HTMLInputElement} */
const settingsCheckbox = document.getElementById("settings-expand");

/**@type {HTMLInputElement} */
const hoverCheckbox = document.getElementById("hover-enabled");
/**@type {HTMLInputElement} */
const hoverColorPicker = document.getElementById("hover-color");

/**@type {HTMLInputElement} */
const lastMoveCheckbox = document.getElementById("last-move-enabled");
/**@type {HTMLInputElement} */
const lastMoveColorPicker = document.getElementById("last-move-color");


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

settingsCheckbox.addEventListener("change", () => {
    if (settingsCheckbox.checked) {
        extraSettings.style.display = "block";
    } else {
        extraSettings.style.display = "none";
    }
});

hoverCheckbox.addEventListener("change", () => {
    if (hoverCheckbox.checked) {
        container.style.setProperty("--tile-hover", hoverColorPicker.value+"1f");
    } else {
        container.style.setProperty("--tile-hover", "#00000000");
    }
})

hoverColorPicker.addEventListener("change", () => {
    container.style.setProperty("--tile-hover", hoverColorPicker.value+"1f");
});

lastMoveCheckbox.addEventListener("change", () => {
    if (lastMoveCheckbox.checked) {
        container.style.setProperty("--tile-last-move", lastMoveColorPicker.value);
    } else {
        container.style.setProperty("--tile-last-move", "#00000000");
    }
})

lastMoveColorPicker.addEventListener("change", () => {
    container.style.setProperty("--tile-last-move", lastMoveColorPicker.value);
});
