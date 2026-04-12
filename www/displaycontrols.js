/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");
/**@type {HTMLDivElement} */
const extraSettings = document.getElementById("extra-display-settings");
/**@type {HTMLInputElement} */
const settingsCheckbox = document.getElementById("settings-expand");

//const ALPHA = "3f";

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
    static observedAttributes = ["var", "desc", "default", "alpha", "rtu"];
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        let v = this.getAttribute("var") || "";
        const ALPHA = this.getAttribute("alpha") || "ff";
        this.shadowRoot.innerHTML = `
	    <label for="${v}-color">${this.getAttribute("desc")}</label>
	    <input type="color" id="${v}-color" value="${localStorage.getItem(v) || this.getAttribute('default') || '#000000'}">
	`;
        let p = localStorage.getItem(v);
        if (p != null) {
            container.style.setProperty(`--${v}`, p+ALPHA);
        } else if (this.hasAttribute("default")) {
            container.style.setProperty(`--${v}`, this.getAttribute("default")+ALPHA);
        }
        let colorPicker = this.shadowRoot.getElementById(`${v}-color`);
        colorPicker.addEventListener(this.hasAttribute("rtu")?"input":"change", () => {
            container.style.setProperty(`--${v}`, colorPicker.value+ALPHA);
            localStorage.setItem(v, colorPicker.value);
            container.dispatchEvent(new CustomEvent("ds-update", {"detail":{"target":v}}));
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
	    <input type="checkbox" id="${v}-enabled"${((this.getAttribute('default')==="true") ?? true)?" checked":""}>
	`;
        let checkbox = this.shadowRoot.getElementById(`${v}-enabled`);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                container.classList.add(v);
            } else {
                container.classList.remove(v);
            }
            container.dispatchEvent(new CustomEvent("ds-update", {"detail":{"target":v}}));
        });
        if (this.getAttribute("default") == false) {
            container.classList.remove(v);
        }
    }
}
customElements.define("x-style-toggle", TTStyleToggle);

class TTNumberBox extends HTMLElement {
    static observedAttributes = ["min", "max", "default", "var", "desc"];
    /**@type {HTMLInputElement} */
    #input;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        let v = this.getAttribute("var") || "";
        let min = this.getAttribute("min");
        min = min?` min="${min}"`:"";
        let max = this.getAttribute("max");
        max = max?` max="${max}"`:"";
        let val = localStorage.getItem(v)??this.getAttribute("default");
        val = val?` value="${val}"`:" value=\"0\"";
        this.shadowRoot.innerHTML = `
        <label for="${v}-number">${this.getAttribute("desc")}</label>
        <input type="number" id="${v}-number"${min}${max}${val}>
        `;
        this.#input = this.shadowRoot.children[1];
        this.id = `x-${v}-number`;
    }

    get value() {
        return this.#input.valueAsNumber;
    }
    set value(v) {
        this.#input.value = v;
    }
}
customElements.define("x-number-box", TTNumberBox);
