(async () => {
    await INCLUDE_FINISHED;
    /**@typedef {import("../../zserver/accounts/types.js").AccountRecord} AccountRecord */
    /**@typedef {import("../../zserver/accounts/types.js").SanctionRecord} SanctionRecord */
    /**@typedef {import("../../zserver/accounts/types.js").PrivGroupRecord} PrivGroupRecord */
    /**@typedef {import("../../zserver/accounts/types.js").AppealRejectionRecord} AppealRejectionRecord */
    /**@type {typeof import("../../commonjs/sanctions.mjs")} */
    const sanctions = await import("/commonjs/sanctions.mjs");
    /**@type {typeof import("../../commonjs/perms.mjs")} */
    const perms = await import("/commonjs/perms.mjs");
    const adminid = (await (await fetch(`https://${document.location.hostname}/acc/admin/check`, {method:"GET"})).json()).name;
    {
        /**@type {HTMLSelectElement} */
        const samtypesel = document.getElementById("sam-typesel");
        for (let i = 0, l = sanctions.SANCTION_INFO.length; i < l; i ++) {
            const info = sanctions.SANCTION_INFO[i];
            const op = document.createElement("option");
            op.value = `${i}`;
            op.textContent = `${info.name} (G${info.g})`;
            samtypesel.appendChild(op);
        }
        samtypesel.children[0].selected = true;
    }
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
        /**@type {AccountRecord} */
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
         * @param {AccountRecord} info
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
            const update = {};
            sanc_manage.children[0].replaceChildren(
                make("span",{"textContent":`Sanction: ${sanctions.SANCTION_INFO[sanction.sanction_id&0x1fffffff].name}`}),
                make("span",{"children":[make("span",{"textContent":"Canceled:"}),make("input",{"type":"checkbox","checked":(sanction.sanction_id&0x20000000)!==0,"disabled":true})]}),
                make("span",{"children":[make("span",{"textContent":"Value:"}),make("input",{"type":"number","value":sanction.value})]}),
                make("span",{"textContent":`Applied By: ${sanction.source}`}),
                make("span",{"textContent":`Applied: ${new Date(sanction.applied).toUTCString()}`}),
                make("span",{"textContent":`Expires: ${new Date(sanction.expires).toUTCString()}`}),
                make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                make("span",{"children":[
                    make("input",{"type":"button","value":"Accept","disabled":!sanction.appeal,"onclick":(e)=>{update.appeal={accept:true};sanction.sanction_id|=0x20000000;e.parentNode.parentNode.querySelector("input[type='checkbox']").checked=true;}}),
                    make("input",{"type":"text","disabled":!sanction.appeal,"oninput":(e)=>{e.parentNode.children[2].disabled=e.value.length===0}}),
                    make("input",{"type":"button","value":"Reject","disabled":true,"onclick":(e)=>{sanction.rejections.push({date:Date.now(),appeal:sanction.appeal,value:0,source:adminid,notes:e.parentNode.children[1].value});update.appeal={accept:false,value:0,notes:e.parentNode.children[1].value};}})
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
                update.acc = curr_info.id;
                update.refid = sanction.refid;
                update.value = sanction.value;
                update.notes = sanction.notes;
                fetch(`https://${document.location.hostname}/acc/admin/Msanction`, {method:"PATCH",headers:[["content-type","application/json"]],body:JSON.stringify(update)}).then(async r => {
                    if (r.status === 200) {
                        alert("sanction updated");
                        document.getElementById("dal-button").click();
                    } else {
                        alert(`Failed (${r.status}):\n${await r.text()}`);
                    }
                });
                // const cont = document.getElementById(`isa-ent-${id}`);
                // cont.querySelector("span.isa-si-notes").textContent = sanction.notes;
                // cont.children[1].textContent = `Canceled: ${(sanction.sanction_id&0x20000000)!==0}`;
                // TODO: update the rest
            };
        }
        /**
         * @param {SanctionRecord} sanction
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
                    make("span",{"textContent":`Expires: ${sanction.expires?new Date(sanction.expires).toUTCString():"Never"}`}),
                    make("span",{"textContent":`Appealable Date: ${new Date(sanction.appealable_date).toUTCString()}`}),
                    make("span",{"textContent":`Appeals Left: ${sanction.appeals_left}`}),
                    make("span",{"textContent":`Appeal: ${sanction.appeal??"<no appeal>"}`}),
                    make("span",{"textContent":`Appealed On: ${sanction.appeal_date?new Date(sanction.appeal_date).toUTCString():"n/a"}`}),
                    make("span",{"textContent":`Appeal Granted: ${sanction.appeal_granted?new Date(sanction.appeal_granted).toUTCString():"No"}`}),
                    make("span",{"textContent":`Appeal Granted By: ${sanction.granted_by??"n/a"}`}),
                    make("span",{"textContent":"Notes:"}),
                    make("span",{"classList":["isa-si-notes"],"textContent":sanction.notes}),
                    make("input",{"type":"button","value":"Manage","onclick":()=>{openManageSanction(id);}}),
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
        /**
         * @param {PrivGroupRecord} privs
         */
        function addPrivs(privs) {
            priv_list.appendChild(
                make("div",{"classList":["ipa-priv-item"],"children":[
                    make("span",{"textContent":`Group: ${privs.name} (${privs.gid})`}),
                    make("div",{"classList":["ipa-priv-list"],"children":privs.privs?privs.privs.toString(2).padStart(32,"0").split("").map((f, i) => f==="1"?make("span",{"textContent":perms.PRIVILEGES[31-i]}):null).filter(v=>v!==null):[make("span",{"textContent":"None"})]})
                ]})
            );
        }
        {
            /**@type {HTMLDivElement} */
            const sanc_add = document.getElementById("sanc-add-modal");
            /**@type {HTMLSelectElement} */
            const typesel = document.getElementById("sam-typesel");
            /**@type {HTMLSelectElement} */
            const dursel = document.getElementById("sam-duration");
            /**@type {HTMLInputElement} */
            const bypass = document.getElementById("sam-bypass-i");
            /**@type {HTMLInputElement} */
            const samval = document.getElementById("sam-value");
            /**@type {HTMLSpanElement} */
            const samvaltype = document.getElementById("sam-valtype");
            /**@type {HTMLInputElement} */
            const can_appeal = document.getElementById("sam-can-appeal-i");
            /**@type {HTMLInputElement} */
            const appeals_allowed = document.getElementById("sam-appeals-left-i");
            /**@type {HTMLTextAreaElement} */
            const samnotes = document.getElementById("sam-notes");
            sanc_add.children[1].onclick = applySanction;
            function applySanction() {
                const id = Number(typesel.value);
                const info = sanctions.SANCTION_INFO[id];
                const dur = sanctions.DURATIONS[Number(dursel.value)];
                const req = {
                    acc: curr_info.id,
                    id: id,
                    bypass: bypass.checked,
                    value: Number(samval.value),
                    expires: dur>=0?Date.now()+dur*86400*1000:0,
                    appeals: can_appeal.checked?Number(appeals_allowed.value):0,
                    notes: samnotes.value
                };
                fetch(`https://${document.location.hostname}/acc/admin/Nsanction`, {method:"POST",headers:[["content-type","application/json"]],body:JSON.stringify(req)}).then(async r => {
                    if (r.status === 200) {
                        alert("Sanction applied successfully");
                        sanc_add.hidden = true;
                    } else {
                        alert(`Failed (${r.status}):\n${await r.text()}`);
                        sanc_add.hidden = true;
                    }
                });
            }
            typesel.onchange = () => {
                const info = sanctions.SANCTION_INFO[typesel.selectedIndex];
                if (info.value === null) {
                    samval.disabled = true;
                    samval.value = "0";
                    samvaltype.textContent = "N/A: ";
                } else {
                    samvaltype.textContent = `${info.value}: `;
                    samval.disabled = false;
                }
                if (info.dur === null) {
                    dursel.parentElement.hidden = true;
                    dursel.selectedIndex = 9;
                } else {
                    dursel.parentElement.hidden = false;
                    dursel.selectedIndex = 0;
                }
            };
            document.getElementById("iqd-add-sanc").onclick = () => {
                typesel.selectedIndex = 0;
                dursel.selectedIndex = 0;
                bypass.checked = false;
                samval.value = "0";
                samval.disabled = true;
                samvaltype.textContent = "N/A: ";
                can_appeal.checked = true;
                appeals_allowed.value = "1";
                samnotes.value = "";
                sanc_add.hidden = false;
            };
        }
    
        return { displayAccountInfo };
    })();
})();