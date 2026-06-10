
/**
 * @typedef {{props:Record<string,string>,attrs:Record<string,string>,styles:Record<string,string>}|(e:HTMLElement)=>void} DefaultSetter
 */

/**
 * a shared component of a polypanel, may appear at most once in each subpanel
 */
class TTSharedPanelComponent extends HTMLElement {
    static observedAttributes = ["name", "definition"];
    /**@type {Record<string,DefaultSetter>} */
    #default_setters = {};
    /**@type {TTVariablePanelGroup} */
    #panelgroup;
    constructor() {
        super();
    }
    connectedCallback() {
        if (this.hasAttribute("definition")) {
            this.#panelgroup = this.parentElement.parentElement;
        }
    }
    /**
     * @param {string} selector
     * @param {DefaultSetter} setter
     */
    setDefault(selector, setter) {
        this.#default_setters[selector] = setter;
    }
    reset() {
        for (const sel in this.#default_setters) {
            this.querySelectorAll(sel).forEach(v => {
                const setter = this.#default_setters[sel];
                if (typeof setter === "object") {
                    for (const prop in setter.props) {
                        v[prop] = setter.props[prop];
                    }
                    for (const attr in setter.attrs) {
                        v.setAttribute(attr, setter.attrs[attr]);
                    }
                    for (const style in setter.styles) {
                        v.style.setProperty(style, setter.styles[style]);
                    }
                } else {
                    setter(v);
                }
            });
        }
    }
    /**
     * @returns {string}
     */
    get name() {
        return this.getAttribute("name");
    }
}
customElements.define("x-pp-shared", TTSharedPanelComponent);

class TTVariablePanel extends HTMLElement {
    static observedAttributes = ["default", "pid", "shared"];
    /**@type {Record<string,TTSharedPanelComponent>} */
    #replaced = {};
    /**@type {TTVariablePanelGroup} */
    #parent;
    constructor() {
        super();
        // this.attachShadow({mode:"open"});
    }
    connectedCallback() {
        if (!this.hasAttribute("default")) {
            this.hidden = true;
        }
        this.id = this.pid+"-pp-panel";
        this.#parent = this.parentElement;
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
    /**
     * @protected
     */
    _releaseShared() {
        /**@type {TTSharedPanelComponent[]} */
        const shared = [];
        this.querySelectorAll("x-pp-shared[definition]").forEach(v => {
            v.reset();
            shared.push(v);
            v.replaceWith(this.#replaced[v.name]);
            delete this.#replaced[v.name];
        });
        this.#parent.getShared().append(...shared);
    }
    /**
     * @protected
     */
    _aquireShared() {
        const shared = this.#parent.getShared();
        this.querySelectorAll("x-pp-shared:not([definition])").forEach(/**@param {TTSharedPanelComponent} v*/v => {
            /**@type {TTSharedPanelComponent} */
            const def = shared.querySelector(`x-pp-shared[name="${v.name}"]`);
            if (def) {
                this.#replaced[v.name] = v;
                v.replaceWith(def);
            }
        });
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
            if (c.hasAttribute("default")) {
                if (f) {
                    c.hidden = true;
                } else {
                    this.#active_panel = c;
                }
                f = true;
            }
        }
        this.switchPanel(this.activeid);
    }
    /**
     * sets the active panel by its panel id
     * @param {string} pid
     */
    switchPanel(pid) {
        if (!pid) return;
        this.#active_panel.hidden = true;
        this.#active_panel._releaseShared();
        this.#active_panel = [...this.children].find(v => v.pid === pid) ?? this.#active_panel;
        this.#active_panel._aquireShared();
        this.#active_panel.hidden = false;
        if (this.#bound_select) this.#bound_select.value = pid;
    }
    get querySelector() {
        return this.#active_panel.querySelector.bind(this.#active_panel);
    }
    /**
     * the active panel's panel id
     */
    get activeid() {
        return this.#active_panel.pid;
    }
    /**
     * @returns {TTVariablePanel}
     */
    getShared() {
        return this.querySelectorAll("x-pp-panel[shared]")[0];
    }
}
customElements.define("x-polypanel", TTVariablePanelGroup);

