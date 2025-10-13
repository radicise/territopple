/**@type {Promise<void>} */
let INCLUDE_FINISHED = null;
{
    let iters = 0;
    async function replaceImports() {
        let tags = document.querySelectorAll("meta[data-import], meta[data-scripts], meta[data-raw-tag]");
        while (tags.length) {
            iters ++;
            if (iters > 3) throw new Error("LOOP LIMIT EXCEEDED");
            await new Promise(r => {
                let n = tags.length;
                tags.forEach(async v => {
                    if (v.getAttribute("data-raw-tag")) {
                        const htag = document.createElement(v.getAttribute("data-raw-tag"));
                        if (v.getAttribute("data-raw-attrs")) {
                            for (const a of v.getAttribute("data-raw-attrs").split(",")) {
                                const al = a.split("=");
                                htag.setAttribute(al[0], al[1]);
                            }
                        }
                        v.replaceWith(htag);
                        n --;
                        if (n === 0) return r();
                        else return;
                    }
                    const scripts = v.getAttribute("data-scripts");
                    if (!v.getAttribute("data-import")) {
                        if (scripts) {
                            scripts.split(",").forEach(p => {
                                const s = document.createElement("script");
                                s.src = p;
                                document.body.appendChild(s);
                            });
                        }
                        v.remove();
                        n --;
                        if (n === 0) return r();
                        else return;
                    }
                    const txt = await (await fetch(v.getAttribute("data-import"))).text();
                    // v.outerHTML = txt;
                    /**@type {HTMLTemplateElement} */
                    const template = document.createElement("template");
                    template.innerHTML = txt;
                    // template.querySelectorAll("script").forEach(s => {
                    //     const newS = document.createElement("script");
                    //     Array.from(s.attributes).forEach(attr => {
                    //         newS.setAttribute(attr.name, attr.value);
                    //     });
                    //     const scriptText = s.innerHTML;
                    //     if (scriptText) {
                    //         newS.appendChild(scriptText);
                    //     }
                    //     s.parentNode.replaceChild(s, newS);
                    // });
                    v.replaceWith(template.content);
                    if (scripts) {
                        scripts.split(",").forEach(p => {
                            const s = document.createElement("script");
                            s.src = p;
                            document.body.appendChild(s);
                        });
                    }
                    n --;
                    if (n === 0) {
                        r();
                    }
                    // v.replaceWith();
                });
            });
            tags = document.querySelectorAll("meta[data-import], meta[data-scripts], meta[data-raw-tag]");
        }
    }
    INCLUDE_FINISHED = new Promise(async (r) => {
        await replaceImports();
        r();
    });
}
