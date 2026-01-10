(async () => {
    await INCLUDE_FINISHED;
    /**@type {typeof import("../../commonjs/sanctions.mjs")} */
    const sanctions = await import("/commonjs/sanctions.mjs");
    /**@type {typeof import("../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");
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
        ent.onkeyup = (e) => {
            if (e.code === "Enter") {
                btn.click();
            }
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
        /**@type {HTMLDivElement} */
        const priv_cont = document.getElementById("info-priv-area");
        /**@type {HTMLDivElement} */
        const priv_list = document.getElementById("ipa-list");
        /**@type {HTMLDivElement} */
        const sanc_manage = document.getElementById("sanc-manage-modal");
        /**@type {import("../../zserver/accounts/types.js").AccountRecord} */
        let curr_info = null;
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
            priv_cont.hidden = false;
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
            priv_list.replaceChildren();
            if (info.priv_level || info.priv_groups) {
                addPrivs({privs:info.priv_level,name:"Inherent",gid:-1});
                info.priv_groups?.forEach(addPrivs);
            } else {
                priv_list.textContent = "None";
            }
            curr_info = info;
        }
        /**
         * @param {number} id
         */
        function openManageSanction(id) {
            const sanction = curr_info.sanction[id];
            sanc_manage.children[0].replaceChildren(
                make("span",{"textContent":`Sanction: ${sanctions.SANCTION_INFO[sanction.sanction_id&0x1fffffff].name}`}),
                make("span",{"children":[make("span",{"textContent":"Canceled:"}),make("input",{"type":"checkbox","checked":(sanction.sanction_id&0x20000000)!==0})]}),
                make("span",{"children":[make("span",{"textContent":"Value:"}),make("input",{"type":"number","value":sanction.value})]}),
                make("span",{"textContent":`Applied By: ${sanction.source}`}),
                make("span",{"textContent":`Applied: ${new Date(sanction.applied).toUTCString()}`}),
                make("span",{"textContent":`Expires: ${new Date(sanction.expires).toUTCString()}`}),
                make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                make("span",{"children":[
                    make("input",{"type":"button","value":"Accept","disabled":!sanction.appeal}),
                    make("input",{"type":"text","disabled":!sanction.appeal,"oninput":(e)=>{e.parentNode.children[2].disabled=e.value.length===0}}),
                    make("input",{"type":"button","value":"Reject","disabled":true})
                ]}),
                make("span",{"textContent":"Notes:"}),
                make("textarea",{"classList":["isa-si-notes"],"value":sanction.notes}),
                make("span",{"textContent":"Rejections:"}),
                make("div",{"classList":["isa-sanction-rejects"],"children":sanction.rejections.length?sanction.rejections.map(reject => make("div",{"classList":["isa-sanction-rejection"],"children":[
                    make("span",{"textContent":`Rejected By: ${reject.source}`}),
                    make("span",{"textContent":`Rejected Date: ${new Date(reject.date).toUTCString()}`}),
                    make("span",{"textContent":`Rejected Appeal: ${reject.appeal}`}),
                    make("span",{"textContent":`Value: ${reject.value}`}),
                    make("span",{"textContent":`Notes: ${reject.notes}`})
                ]})):[make("span",{"textContent":"None"})]})
            );
            sanc_manage.hidden = false;
            sanc_manage.children[1].onclick = () => {
                sanc_manage.hidden = true;
                sanction.notes = sanc_manage.children[0].querySelector("textarea").value;
                sanction.sanction_id &= 0x5fffffff;(sanc_manage.children[0].querySelector("input[type='checkbox']").checked?0x7fffffff:0);
                sanction.sanction_id |= (sanc_manage.children[0].querySelector("input[type='checkbox']").checked?0x20000000:0);
                sanction.value = Number(sanc_manage.children[0].querySelector("input[type='number']").value);
            };
        }
        /**
         * @param {import("../../zserver/accounts/types.js").SanctionRecord} sanction
         * @param {number} id
         */
        function addSanction(sanction, id) {
            sanction_list.appendChild(
                make("div",{"id":`isa-ent-${id}`,"classList":["isa-sanction-item"],"children":[
                    make("span",{"textContent":`Sanction: ${sanctions.SANCTION_INFO[sanction.sanction_id&0x1fffffff].name}`}),
                    make("span",{"textContent":`Canceled: ${(sanction.sanction_id&0x20000000)!==0}`}),
                    make("span",{"textContent":`Value: ${sanction.value}`}),
                    make("span",{"textContent":`Applied By: ${sanction.source}`}),
                    make("span",{"textContent":`Applied: ${new Date(sanction.applied).toUTCString()}`}),
                    make("span",{"textContent":`Expires: ${new Date(sanction.expires).toUTCString()}`}),
                    make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                    make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                    make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                    make("span",{"textContent":"Notes:"}),
                    make("span",{"classList":["isa-si-notes"],"textContent":sanction.notes}),
                    make("input",{"type":"button","value":"Manage","onclick":()=>{openManageSanction(id);}}),
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
        /**
         * @param {import("../../zserver/accounts/types.js").PrivGroupRecord} privs
         */
        function addPrivs(privs) {
            priv_list.appendChild(
                make("div",{"classList":["ipa-priv-item"],"children":[
                    make("span",{"textContent":`Group: ${privs.name} (${privs.gid})`}),
                    make("div",{"classList":["ipa-priv-list"],"children":privs.privs?privs.privs.toString(2).padStart(32,"0").split("").map((f, i) => f==="1"?make("span",{"textContent":perms.PRIVILEGES[31-i]}):null).filter(v=>v!==null):[make("span",{"textContent":"None"})]})
                ]})
            );
        }
    
        return { displayAccountInfo };
    })();
})();