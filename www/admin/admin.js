(async () => {
    await INCLUDE_FINISHED;
    /**@type {typeof import("../../commonjs/sanctions.mjs")} */
    const sanctions = await import("/commonjs/sanctions.mjs");
    {
        /**@type {HTMLInputElement} */
        const ent = document.getElementById("dal-entry");
        /**@type {HTMLInputElement} */
        const btn = document.getElementById("dal-button");
        /**@type {HTMLSpanElement} */
        const err = document.getElementById("dal-error");
        btn.onclick = () => {
            fetch(`https://${document.location.hostname}/acc/admin/info?id=${ent.value}`, {method:"GET"}).then(async (res) => {
                if (res.status === 200) {
                    err.textContent = "";
                    displayAccountInfo(await res.json());
                } else {
                    err.textContent = `Error ${res.status}: ${await res.text()}`;
                }
            });
        };
    }
    const { displayAccountInfo } = (()=>{
        /**@type {HTMLDivElement} */
        const iqd_cont = document.getElementById("info-quick-details");
        /**@type {HTMLSpanElement} */
        const iqd_id = document.getElementById("iqd-id");
        /**@type {HTMLSpanElement} */
        const iqd_name = document.getElementById("iqd-name");
        /**@type {HTMLSpanElement} */
        const iqd_email = document.getElementById("iqd-email");
        /**@type {HTMLInputElement} */
        const iqd_email_btn = document.getElementById("iqd-email-btn");
        /**@type {HTMLSpanElement} */
        const iqd_cdate = document.getElementById("iqd-cdate");
        /**@type {HTMLSpanElement} */
        const iqd_ldate = document.getElementById("iqd-ldate");
        /**@type {HTMLDivElement} */
        const sanction_cont = document.getElementById("info-sanction-area");
        /**@type {HTMLDivElement} */
        const sanction_list = document.getElementById("isa-list");
        let acc_email = "n/a";
        iqd_email_btn.onclick = () => {
            if (iqd_email_btn.value === "show") {
                iqd_email_btn.value = "hide";
                iqd_email.textContent = acc_email;
            } else {
                iqd_email_btn.value = "show";
                iqd_email.textContent = "<hidden>";
            }
        };
        /**
         * @param {import("../../zserver/accounts/types.js").AccountRecord} info
         */
        function displayAccountInfo(info) {
            iqd_cont.hidden = false;
            sanction_cont.hidden = false;
            iqd_id.textContent = info.id;
            iqd_name.textContent = info.name;
            acc_email = info.email;
            iqd_email.textContent = "<hidden>";
            iqd_email_btn.value = "show";
            iqd_cdate.textContent = new Date(info.cdate).toUTCString();
            iqd_ldate.textContent = new Date(info.last_online).toUTCString();
            sanction_list.replaceChildren();
            if (info.sanction.length) {
                info.sanction.forEach(addSanction);
            } else {
                sanction_list.textContent = "None";
            }
        }
        /**
         * @param {import("../../zserver/accounts/types.js").SanctionRecord} sanction
         */
        function addSanction(sanction) {
            sanction_list.appendChild(
                make("div",{"classList":["isa-sanction-item"],"children":[
                    make("span",{"textContent":`Sanction: ${sanctions.SANCTION_INFO[sanction.sanction_id].name}`}),
                    make("span",{"textContent":`Value: ${sanction.value}`}),
                    make("span",{"textContent":`Applied By: ${sanction.source}`}),
                    make("span",{"textContent":`Applied: ${new Date(sanction.applied).toUTCString()}`}),
                    make("span",{"textContent":`Expires: ${new Date(sanction.expires).toUTCString()}`}),
                    make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                    make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                    make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                    make("span",{"textContent":"Notes:"}),
                    make("span",{"textContent":sanction.notes}),
                    make("span",{"textContent":"Rejections:"}),
                    make("div",{"classList":["isa-sanction-rejects"],"children":sanction.rejections.length?sanction.rejections.map(reject => make("div",{"classList":["isa-sanction-rejection"],"children":[
                        make("span",{"textContent":`Rejected By: ${reject.source}`}),
                        make("span",{"textContent":`Rejected Date: ${reject.date}`}),
                        make("span",{"textContent":`Rejected Appeal: ${reject.appeal}`}),
                        make("span",{"textContent":`Value: ${reject.value}`}),
                        make("span",{"textContent":`Notes: ${reject.notes}`})
                    ]})):[make("span",{"textContent":"None"})]})
                ]})
            );
        }
    
        return { displayAccountInfo };
    })();
})();