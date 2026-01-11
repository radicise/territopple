(async () => {
    await INCLUDE_FINISHED;
    /**@type {typeof import("../../../commonjs/sanctions.mjs")} */
    const sanctions = await import("/commonjs/sanctions.mjs");
    /**@type {HTMLDivElement} */
    const area = document.getElementById("sanction-area");
    fetch(`https://${document.location.hostname}/acc/pub/%40self/sanction`, {method:"GET"}).then(async (v) => {
        /**@type {import("../../../zserver/accounts/types.js").SanctionRecord[]} */
        const sancs = await v.json();
        if (sancs.length === 0) {
            area.replaceChildren("No sanctions, you're all good!");
            return;
        }
        area.replaceChildren();
        sancs.forEach(addSanction);
    });
    /**
     * @param {import("../../../zserver/accounts/types.js").SanctionRecord} sanction
     */
    function addSanction(sanction) {
        area.appendChild(
            make("div",{"classList":["isa-sanction-item"],"children":[
                make("span",{"textContent":`Sanction: ${sanctions.SANCTION_INFO[sanction.sanction_id&0x1fffffff].name}`}),
                make("span",{"textContent":`Value: ${sanction.value}`}),
                make("span",{"textContent":`Applied By: ${sanction.source}`}),
                make("span",{"textContent":`Applied: ${new Date(sanction.applied).toUTCString()}`}),
                make("span",{"textContent":`Expires: ${sanction.expires?new Date(sanction.expires).toUTCString():"Never"}`}),
                make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                make("span",{"textContent":"Rejections:"}),
                make("div",{"classList":["isa-sanction-rejects"],"children":sanction.rejections.length?sanction.rejections.map(reject => make("div",{"classList":["isa-sanction-rejection"],"children":[
                    make("span",{"textContent":`Rejected By: ${reject.source}`}),
                    make("span",{"textContent":`Rejected Date: ${new Date(reject.date).toUTCString()}`}),
                    make("span",{"textContent":`Rejected Appeal: ${reject.appeal}`}),
                    make("span",{"textContent":`Value: ${reject.value}`}),
                    make("span",{"textContent":`Notes: ${reject.notes}`})
                ]})):[make("span",{"textContent":"None"})]})
            ]})
        );
    }
})();
