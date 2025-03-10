
const NS = "http://www.w3.org/2000/svg";
/**@type {SVGSVGElement} */
// const SVG = document.getElementById("svg-renderer");
const SVG = document.createElementNS(NS, "svg");
SVG.setAttribute("xmlns", NS);
SVG.setAttribute("version", "1.1");
SVG.setAttribute("viewBox", "0 0 100 100");
SVG.setAttribute("width", "100");
SVG.setAttribute("height", "100");
// SVG.width = 100;
// SVG.height = 100;
{
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<g id="fill-one">
            <rect width="10" height="10" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="2.5" y="2.5" width="5" height="5" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="black" stroke-width="0.25" />
        </g>
        <g id="fill-two">
            <rect width="10" height="10" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="black" stroke-width="0.25" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="black" stroke-width="0.25" />
        </g>
        <g id="fill-three">
            <rect width="10" height="10" fill="white" stroke="black" stroke-width="0.25" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="black" stroke-width="0.25" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="black" stroke-width="0.25" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="black" stroke-width="0.25" />
        </g>
        <g id="fill-four">
            <rect width="10" height="10" stroke="black" stroke-width="0.25" />
            <rect x="1.25" y="1.25" width="7.5" height="7.5" stroke="black" stroke-width="0.25" />
            <rect x="2.5" y="2.5" width="5" height="5" stroke="black" stroke-width="0.25" />
            <rect x="3.75" y="3.75" width="2.5" height="2.5" stroke="black" stroke-width="0.25" />
        </g>`;
    SVG.appendChild(defs);
}
let x = ["one", "two", "three", "four"];
let y = 0;
for (const a of x) {
    const useE = document.createElementNS(NS, "use");
    // useE.setAttributeNS(NS, "href", "#fill-four");
    // useE.setAttribute("href", "#fill-one");
    useE.setAttribute("href", `#fill-${a}`);
    useE.setAttribute("fill", "lime");
    useE.setAttribute("x", `${y*10}`);
    y ++;
    // useE.fill = "lime";
    SVG.appendChild(useE);
}
document.body.appendChild(SVG);

function cycle() {}
