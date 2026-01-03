fetch(`https://${document.location.hostname}/acc/admin/check`, {method:"GET"}).then(v => {
    if (v.status !== 200) {
        location.href = "/admin/login.html";
    } else {
        v.json().then(j => {
            document.getElementById("admin-name").children[0].textContent = `${j.name} `;
            document.getElementById("admin-name").children[1].children[0].textContent = "logout";
            document.getElementById("admin-name").children[1].children[0].href = "/admin/logout";
        });
    }
});