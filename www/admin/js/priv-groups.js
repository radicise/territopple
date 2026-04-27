fetch(`https://${document.location.hostname}/acc/admin/pgrp/list?page=1`, {method:"GET"}).then(res => {
    if (res.ok) {
        res.json().then(data => console.log(data));
    } else {
        res.text().then(data => console.log(data));
    }
});

