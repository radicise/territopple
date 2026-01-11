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
     * @param {number} refid
     * @param {string} message
     */
    function makeAppeal(refid, message) {
        fetch(`https://${document.location.hostname}/acc/make-appeal`, {method:"POST",headers:[["content-type","application/json"]],body:JSON.stringify({refid,message})}).then(async (v) => {
            if (v.status === 200) {
                window.location.reload();
            } else {
                alert(`Request Failed:\nError ${v.status}: ${await v.text()}`);
            }
        });
    }
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
                make("span",{"textContent":`Appealed On: ${sanction.appeal_date?new Date(sanction.appeal_date).toUTCString():"n/a"}`}),
                make("span",{"textContent":`Appeal Granted: ${sanction.appeal_granted?new Date(sanction.appeal_granted).toUTCString():"No"}`}),
                make("span",{"textContent":`Appeal Granted By: ${sanction.granted_by??"n/a"}`}),
                make("span",{"children":[
                    make("input",{"type":"text","oninput":(e)=>{e.parentNode.children[1].disabled=e.value.length===0;},"disabled":sanction.appealable_date>0&&sanction.appealable_date<=Date.now()&&sanction.appeals_left>0}),
                    make("input",{"type":"button","onclick":(e)=>{makeAppeal(sanction.refid,e.parentNode.children[0].value);},"disabled":true})
                ]}),
                make("span",{"textContent":"Rejections:"}),
                make("div",{"classList":["isa-sanction-rejects"],"children":sanction.rejections.length?sanction.rejections.map(reject => make("div",{"classList":["isa-sanction-rejection"],"children":[
                    make("span",{"textContent":`Rejected By: ${reject.source}`}),
                    make("span",{"textContent":`Rejected Date: ${new Date(reject.date).toUTCString()}`}),
                    make("span",{"textContent":`Rejected Appeal: ${reject.appeal}`}),
                    make("span",{"textContent":`Appeal Date: ${new Date(reject.adate).toUTCString()}`}),
                    make("span",{"textContent":`Value: ${reject.value}`}),
                    make("span",{"textContent":`Notes: ${reject.notes}`})
                ]})):[make("span",{"textContent":"None"})]})
            ]})
        );
    }
})();
