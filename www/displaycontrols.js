/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");
/**@type {HTMLDivElement} */
const extraSettings = document.getElementById("extra-display-settings");
/**@type {HTMLInputElement} */
const settingsCheckbox = document.getElementById("settings-expand");

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
	    <input type="color" id="${v}-color" value="${localStorage.getItem(v) || this.getAttribute('default') || '#000000'}">
	`;
        let p = localStorage.getItem(v);
        if (p != null) {
            container.style.setProperty(`--${v}`, p+"1f");
        } else if (this.hasAttribute("default")) {
            container.style.setProperty(`--${v}`, this.getAttribute("default")+"1f");
        }
        let colorPicker = this.shadowRoot.getElementById(`${v}-color`);
        colorPicker.addEventListener("change", () => {
            container.style.setProperty(`--${v}`, colorPicker.value+"1f");
            localStorage.setItem(v, colorPicker.value);
        });
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
        let checkbox = this.shadowRoot.getElementById(`${v}-enabled`);
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
