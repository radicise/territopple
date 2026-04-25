fetch(`https://${document.location.hostname}/acc/pub/%40self/info`).then(v => {
    const tar = document.getElementById("account-name").children[1];
    if (v.status === 200) {
        v.json().then(j => {
            tar.children[0].textContent = `${j.name} `;
            tar.children[1].children[0].textContent = "profile";
            tar.children[1].children[0].href = "/account/info";
        });
    } else {
        tar.children[0].textContent = "Guest ";
        tar.children[1].children[0].textContent = "login";
    }
});
document.getElementById("account-name").children[0].children[1].addEventListener("change", function () {
    document.body.parentElement.style.setProperty("--theme", this.value);
    localStorage.setItem("usrdisp-ldtheme", this.value);
});
{
    const saved_theme = localStorage.getItem("usrdisp-ldtheme") || "light dark";
    /**@type {HTMLSelectElement} */
    const s = document.getElementById("account-name").children[0].children[1];
    s.value = saved_theme;
    document.body.parentElement.style.setProperty("--theme", saved_theme);
}
