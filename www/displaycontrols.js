/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");
/**@type {HTMLDivElement} */
const extraSettings = document.getElementById("extra-display-settings");
/**@type {HTMLInputElement} */
const settingsCheckbox = document.getElementById("settings-expand");

/**@type {HTMLInputElement} */
const lastMoveCheckbox = document.getElementById("last-move-enabled");


function setTileSize() {
    container.style.setProperty("--tile-font-size", slider.value);
    window.dispatchEvent(new CustomEvent("gameboard-fresize"));
}
slider.addEventListener("change", () => {
    window.dispatchEvent(new CustomEvent('gameboard-fresize'));
});

settingsCheckbox.addEventListener("change", () => {
    if (settingsCheckbox.checked) {
        extraSettings.style.display = "block";
    } else {
        extraSettings.style.display = "none";
    }
});

lastMoveCheckbox.addEventListener("change", () => {
    displaySettings.highlightLastMove = lastMoveCheckbox.checked;
    // if (lastMoveCheckbox.checked) {
    //     container.style.setProperty("--tile-last-move", lastMoveColorPicker.value);
    // } else {
    //     container.style.setProperty("--tile-last-move", "#00000000");
    // }
})

class TTColorPicker extends HTMLElement {
    static observedAttributes = ["var", "desc", "default"];
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        let v = this.getAttribute("var") || "";
        this.shadowRoot.innerHTML = `
	    <label for="${v}-color">${this.getAttribute("desc")}</label>
	    <input type="color" id="${v}-color" value="${this.getAttribute('default') || '#000000'}">
	`;
        let colorPicker = this.shadowRoot.getElementById(`${v}-color`);
        colorPicker.addEventListener("change", () => {
            container.style.setProperty(`--{v}`, colorPicker.value+"1f");
            localStorage.setItem(v, colorPicker.value);
        });
        let p = localStorage.getItem(v);
        if (p) {
            container.style.setProperty(`--{v}`, p);
        } else if (this.hasProperty("default")) {
            container.style.setProperty(`--{v}`, this.getAttribute("default"));
        }
    }
}
customElements.define("x-color-picker", TTColorPicker);

class TTStyleToggle extends HTMLElement {
    static observedAttributes = ["var", "default"];
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        let v = this.getAttribute("var") || "";
        this.shadowRoot.innerHTML = `
	    <input type="checkbox" id="${v}-enabled" checked="${this.getAttribute('default') || true}">
	`;
        let checkbox = this.shadowRoot.getElementById(`${v}-color`);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                container.classList.add(v);
            } else {
                container.classList.remove(v);
            }
        });
        if (this.getAttribute("default") == false) {
            container.classList.remove(v);
        }
    }
}
customElements.define("x-style-toggle", TTStyleToggle);

for (const [picker, checker, valueName, styleName] of [[hoverColorPicker, hoverCheckbox, "hoverColor", "--tile-hover"], [lastMoveColorPicker, lastMoveCheckbox, "lastMoveColor", "--tile-last-move"], [volatileColorPicker, volatileCheckbox, "volatileColor", "--tile-volatile"]]) {
    const value = localStorage.getItem(valueName);
    if (Boolean(value)) {
        picker.value = value;
        container.style.setProperty(styleName, value+"1f");
    } else if (value === "false") {
        checker.checked = false;
        switch (valueName) {
            case "hoverColor":container.classList.remove("tile-hover");break;
            case "lastMoveColor":displaySettings.highlightLastMove = false;break;
            case "volatileColor":container.classList.remove("volatiles");break;
        }
    } else {
        localStorage.setItem(valueName, picker.value);
    }
}
