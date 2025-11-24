fetch(`https://${document.location.hostname}/acc/pub/%40self/info`).then(v => {
    if (v.status === 200) {
        v.json().then(j => {
            document.getElementById("account-name").children[0].textContent = `${j.name} `;
            document.getElementById("account-name").children[1].children[0].textContent = "profile";
            document.getElementById("account-name").children[1].children[0].href = "/account/info";
        });
    } else {
        document.getElementById("account-name").children[0].textContent = "Guest ";
        document.getElementById("account-name").children[1].children[0].textContent = "login";
    }
});
