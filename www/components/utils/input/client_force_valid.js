document.querySelectorAll("input[data-watch]").forEach(/**@param {HTMLInputElement} v*/v => {
    v.addEventListener("change", () => {
        switch (v.type) {
            case "number":{
                if (v.min !== undefined) {
                    if (Number(v.value) < Number(v.min)) {
                        v.value = v.min;
                    }
                }
                if (v.max !== undefined) {
                    if (Number(v.value) > Number(v.max)) {
                        v.value = v.max;
                    }
                }
                break;
            }
        }
    });
});