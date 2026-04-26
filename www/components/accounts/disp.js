fetch(`https://${document.location.hostname}/acc/pub/%40self/info`).then(v => {
    const tar = document.getElementById("account-name").children[1];
    if (v.status === 200) {
        v.json().then(j => {
            tar.children[1].textContent = `${j.name} `;
            tar.children[2].children[0].textContent = "profile";
            tar.children[2].children[0].href = "/account/info";
        });
    } else {
        tar.children[1].textContent = "Guest ";
        tar.children[2].children[0].textContent = "login";
    }
});
fetch(`https://${document.location.hostname}/acc/pfp/get?tar=%40self`).then(v => {
    /**@type {HTMLImageElement} */
    const tar = document.getElementById("account-name").children[1].children[0];
    if (v.status === 200) {
        tar.hidden = false;
    }
});
document.getElementById("account-name").children[0].children[1].addEventListener("change", function () {
    document.body.parentElement.style.setProperty("--theme", this.value);
});
