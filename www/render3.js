import * as three from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";

console.log("done loading 3d render script");

if (document.getElementById("feature-3d")?.nodeName !== "META") {
    throw new Error("this module should not be loaded");
}

window.addEventListener("board-update", () => {});
