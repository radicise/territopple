/**
 * @typedef {{textContent:string}} _TDTEXTOPS
 * @typedef {{children:HTMLElement[]}} _TDCHILDOPS
 * @typedef {_TDTEXTOPS|_TDCHILDOPS} TDOPS
 * @typedef {["td"]|["td",TDOPS]} TDOPARR
 */
/**
 * @typedef {{textContent:string?,id:string?,classList:string[]?}} _SPANTEXTOPS
 * @typedef {{children:HTMLElement[],id:string?,classList:string[]?}} _SPANCHILDOPS
 * @typedef {_SPANTEXTOPS|_SPANCHILDOPS} SPANOPS
 * @typedef {["span"]|["span",SPANOPS]} SPANOPARR
 */
/**
 * @typedef {{type:"button",id:string?,value:string,onclick:VoidFunction?}} _INPBTNOPS
 * @typedef {{type:"text",id:string?,placeholder:string?}} _INPTEXTOPS
 * @typedef {{type:"email",id:string?,placeholder:string?}} _INPEMAILOPS
 * @typedef {{type:"password",id:string?}} _INPPWOPS
 * @typedef {{type:"image",id:string?,alt:string?,title:string?,src:string,onclick:VoidFunction?}} _INPIMGOPS
 * @typedef {_INPBTNOPS|_INPTEXTOPS|_INPEMAILOPS|_INPPWOPS|_INPIMGOPS} INPOPS
 * @typedef {["input",INPOPS]} INPOPARR
 */

/**
 * @type {{
 * (nodename:"td",attrs:TDOPS?): HTMLTableCellElement;
 * (nodename:"span",attrs:SPANOPS?): HTMLSpanElement;
 * (nodename:"input",attrs:INPOPS): HTMLInputElement;
 * (nodename:"div",attrs:SPANOPS?): HTMLDivElement;
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]>): HTMLTableCellElement[];
 * (nodename:Array<["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]>): HTMLSpanElement[];
 * (nodename:Array<["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): HTMLInputElement[];
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]>): Array<HTMLTableCellElement|HTMLSpanElement>;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLTableCellElement|HTMLInputElement>;
 * (nodename:Array<["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLSpanElement|HTMLInputElement>;
 * (): void;
 * (nodename:Array<["td"]|["td",{textContent:string}]|["td",{children:HTMLElement[]}]|["span"]|["span",{textContent:string?,id:string?,classList:string[]?}]|["span",{children:HTMLElement[]?,id:string?,classList:string[]?}]|["input",{type:"button",id:string?,value:string,onclick:VoidFunction?}]|["input",{type:"text",id:string?,placeholder:string?}]|["input",{type:"email",id:string?,placeholder:string?}]|["input",{type:"password",id:string?}]>): Array<HTMLTableCellElement|HTMLSpanElement|HTMLInputElement>;
 * }}
 */
const make = (nodename, attrs) => {
    if (Array.isArray(nodename)) {
        return nodename.map(v => make(v[0], v[1]));
    }
    const e = document.createElement(nodename);
    if (attrs?.textContent) {
        e.textContent = attrs.textContent;
    }
    if (attrs?.id) {
        e.id = attrs.id;
    }
    if (attrs?.classList) {
        e.classList.add(...attrs.classList);
    }
    if (attrs?.type) {
        e.type = attrs.type;
    }
    if (attrs?.value) {
        e.value = attrs.value;
    }
    if (attrs?.placeholder) {
        e.placeholder = attrs.placeholder;
    }
    if (attrs?.onclick) {
        e.onclick = attrs.onclick;
    }
    if (attrs?.children) {
        e.replaceChildren(...attrs.children);
    }
    if (attrs?.src) {
        e.src = attrs.src;
    }
    if (attrs?.alt) {
        e.alt = attrs.alt;
    }
    if (attrs?.title) {
        e.title = attrs.title;
    }
    if (attrs?.checked) {
        e.checked = attrs.checked;
    }
    if (attrs?.disabled) {
        e.disabled = attrs.disabled;
    }
    if (attrs?.oninput) {
        e.oninput = (ev)=>{attrs.oninput(e,ev);};
    }
    return e;
};
