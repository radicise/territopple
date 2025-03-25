/* <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
<link rel="shortcut icon" href="/favicon/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
<link rel="manifest" href="/favicon/site.webmanifest" /> */
{
    const mkLink = (rel,href,o) => {
        let type = o?.type;
        let sizes = o?.sizes;
        const l = document.createElement("link");
        l.rel = rel;
        l.href = href;
        if (type) l.type = type;
        if (sizes) l.sizes = sizes;
        return l;
    };
    document.head.append(
        mkLink("icon","/favicon/favicon-96x96.png",{type:"image/png",sizes:"96x96"}),
        mkLink("icon","/favicon/favicon.svg",{type:"image/svg+xml"}),
        mkLink("shortcut icon","/favicon/favicon.ico"),
        mkLink("apple-touch-icon","/favicon/apple-touch-icon.png",{sizes:"180x180"}),
        mkLink("manifest","/favicon/site.webmanifest")
    );
}
