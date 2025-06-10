{
    const e = document.createElement("link");
    e.rel = "stylesheet";
    e.type = "text/css";
    // e.href = "./helpers/banners.css";
    const v = (location.hash?.slice(1)||"");
    e.href = v.length > 0 ? "/helpers/banners/"+v : "/helpers/banners.css";
    document.head.appendChild(e);
}
const BANNER_CONTAINER = document.createElement("div");
BANNER_CONTAINER.id = "helper-banner-container";
// BANNER_CONTAINER.classList.add("helper-banner-container");
document.body.appendChild(BANNER_CONTAINER);

/**
 * creates a new banner
 * @param {object} options
 * @param {"info"|"error"|"warning"} options.type
 * @param {string} options.content
 * @param {boolean?} options.fade defaults to true
 * @returns {void}
 */
function createBanner(options) {
    const b = document.createElement("div");
    b.classList.add("helper-banner-base", options.type);
    const icon = document.createElement("img");
    icon.src = "/helpers/banner-icons/"+options.type+".svg";
    b.append(icon);
    b.append(options.content);
    if (options.fade ?? true) {
        b.classList.add("helper-banner-fade");
        b.addEventListener("animationend", () => {
            BANNER_CONTAINER.removeChild(b);
        });
    }
    b.addEventListener("click", () => {
        BANNER_CONTAINER.removeChild(b);
    });
    BANNER_CONTAINER.appendChild(b);
    // document.body.appendChild(b);
}

// createBanner({"type":"info",content:"test - info"});
// createBanner({"type":"warning",content:"test - warning"});
// createBanner({"type":"error",content:"test - error"});
