
class TTVariablePanel extends HTMLElement {
    static observedAttributes = ["default", "pid"];
    constructor() {
        super();
        // this.attachShadow({mode:"open"});
    }
    connectedCallback() {
        if (!this.getAttribute("default")) {
            this.hidden = true;
        }
    }
    /**
     * @returns {string}
     */
    get pid() {
        return this.getAttribute("pid") ?? "";
    }
    /**
     * @param {string} pid
     */
    set pid(pid) {
        this.setAttribute("pid", pid);
    }
}
customElements.define("x-pp-panel", TTVariablePanel);

class TTVariablePanelGroup extends HTMLElement {
    static observedAttributes = ["bound-select"];
    /**@type {TTVariablePanel} */
    #active_panel;
    /**@type {HTMLSelectElement} */
    #bound_select;
    constructor() {
        super();
        // this.attachShadow({mode:"open"});
    }
    connectedCallback() {
        if (this.getAttribute("bound-select")) {
            this.#bound_select = document.getElementById(this.getAttribute("bound-select"));
            this.#bound_select.addEventListener("change", () => {
                this.switchPanel(this.#bound_select.value);
            });
        }
        let f = false;
        for (const c of this.children) {
            if (c.getAttribute("default")) {
                if (f) {
                    c.hidden = true;
                } else {
                    this.#active_panel = c;
                }
                f = true;
            }
        }
    }
    /**
     * sets the active panel by its panel id
     * @param {string} pid
     */
    switchPanel(pid) {
        this.#active_panel.hidden = true;
        this.#active_panel = [...this.children].find(v => v.pid === pid) ?? this.#active_panel;
        this.#active_panel.hidden = false;
        this.#bound_select.value = pid;
    }
    get querySelector() {
        return this.#active_panel.querySelector;
    }
    /**
     * the active panel's panel id
     */
    get activeid() {
        return this.#active_panel.pid;
    }
}
customElements.define("x-polypanel", TTVariablePanelGroup);

