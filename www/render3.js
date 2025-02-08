import * as three from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { preserveCopy } from "./render_helper/updater.js";

console.log("done loading 3d render script");

if (document.getElementById("feature-3d")?.nodeName !== "META") {
    throw new Error("this module should not be loaded");
}

const container = document.getElementById("gameboard");

const scene = new three.Scene();
scene.background = new three.Color(0,0,0);
const camera = new three.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new SVGRenderer();
renderer.setSize(container.clientWidth, container.clientHeight);

window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

container.appendChild(renderer.domElement);

function createCircleGeom(divisions) {
    const vertices = [];
    for ( let i = 0; i <= divisions; i ++ ) {

        const v = ( i / divisions ) * ( Math.PI * 2 );

        const x = Math.sin( v );
        const z = Math.cos( v );

        vertices.push( x, 0, z );

    }
    return new three.BufferGeometry().setAttribute('position', new three.Float32BufferAttribute(vertices, 3));
}

const geom = createCircleGeom(50);
const mat = new three.LineBasicMaterial({color:0x00ff00,linewidth:10});
const line = new three.Line(geom, mat);
const line2 = new three.Line(geom, mat);
line2.scale.setScalar(0.25);
line2.position.x = 2;
line.scale.setScalar(0.5);
line.rotation.x = Math.PI/2;
line.add(line2);
scene.add(line);
renderer.render(scene, camera);

const _keymap = {};
window.addEventListener("blur", () => {
    for (const key in _keymap) {
        delete _keymap[key];
    }
});

let co = false;

document.addEventListener("keydown", (e) => {
    if (e.code === "Slash" && "ShiftLeft" in _keymap && !co) {
        co = true;
        electron.send("console:open");
    }
    _keymap[e.code] = true;
});
document.addEventListener("keyup", (e) => {
    delete _keymap[e.code];
});

let reftime = performance.now();

function physics() {
    let time;
    {const ntime = performance.now();time=ntime-reftime;reftime=ntime;}
    if("KeyU" in _keymap)line.rotateX(time*Math.PI/180);
    if("KeyI" in _keymap)line.rotateY(time*Math.PI/180);
    if("KeyO" in _keymap)line.rotateZ(time*Math.PI/180);
    if("KeyJ" in _keymap)preserveCopy(line, new three.Line(geom, new three.LineDashedMaterial({color:0xff0000,linewidth:1,gapSize:10,dashSize:1})), "position", "rotation", "scale");
    if("KeyK" in _keymap)preserveCopy(line2, new three.Line(geom, new three.LineDashedMaterial({color:0x0000ff,linewidth:1,gapSize:10,dashSize:1})), "position", "rotation", "scale");
}
const physintid = setInterval(physics, 1000/60);

let _animating = true;

function animate() {
    if (_animating)renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

window.addEventListener("board-update", () => {});
