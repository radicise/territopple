import * as three from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { preserveCopy } from "./render_helper/updater.js";

console.log("done loading 3d render script");

const team_colors = [new three.Color(33,33,33),new three.Color(255,0,0),new three.Color(0,0,255),new three.Color(0xbf,0,0xbf),new three.Color(0,0xbf,0xbf),new three.Color(0xbf,0xbf,0)];
// let teamcols = ["#333333", "#ff0000", "#0000ff", "#bf00bf", "#00bfbf", "#bfbf00"];

const allow_exec = document.getElementById("feature-3d")?.nodeName === "META";
// if (document.getElementById("feature-3d")?.nodeName !== "META") {
//     throw new Error("this module should not be loaded");
// }

const container = document.getElementById("gameboard");
// let size = Number(container.style.getPropertyValue("--tile-font-size"));

// let viewhmin = -1;
// let viewhmax = 1;
// let viewvmin = -1;
// let viewvmax = 1;
// let viewmargin = 0;
let viewhmin = -2.5;
let viewhmax = 2.5;
let viewvmin = -2.5;
let viewvmax = 2.5;
let viewmargin = 0.5;

const scene = new three.Scene();
// scene.background = new three.Color(0,0,0);
scene.background = new three.Color(255,255,255);
/**@type {"ortho"|"perspective"} */
const cam_style = "ortho";
const camera = (cam_style === "perspective") ? new three.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 1000) : (cam_style === "ortho") ? new three.OrthographicCamera(viewhmin-viewmargin, viewhmax+viewmargin, viewvmax+viewmargin, viewvmin-viewmargin) : null;
// camera.position.z = 15;
camera.position.y = 5;
camera.rotation.x = -Math.PI/2;

// const renderer = new SVGRenderer();
const renderer = new three.WebGLRenderer({antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);

function handleResize(suppress_update) {
    if (cam_style === "perspective") {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    } else if (cam_style === "ortho") {
        // camera.left = viewhmin-viewmargin;
        // camera.right = viewhmax+viewmargin;
        // camera.top = viewvmin-viewmargin;
        // camera.bottom = viewvmax+viewmargin;
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    if (!suppress_update) {
        renderer.render(scene, camera);
    }
}
window.addEventListener("resize", () => {handleResize();});
window.addEventListener("gameboard-resize", () => {handleResize(true);});
window.addEventListener("gameboard-fresize", () => {handleResize();});
// window.addEventListener("resize", () => {
// });
// window.addEventListener("gameboard-resize", () => {
//     camera.aspect = container.clientWidth / container.clientHeight;
//     camera.updateProjectionMatrix();
//     renderer.setSize(container.clientWidth, container.clientHeight);
// });

// container.appendChild(renderer.domElement);
// document.body.appendChild(renderer.domElement);

const spgeom = new three.SphereGeometry(1, 32, 32, 0, Math.PI, 0, Math.PI);
// const spgeom = new three.BoxGeometry(5,5,5);
// const spmat = new three.MeshPhongMaterial({color:new three.Color(0,255,0)});
// const spmat3 = new three.MeshPhongMaterial({color:new three.Color(0,0,255)});
// const spmat4 = new three.MeshPhongMaterial({color:new three.Color(255,0,255)});
const spmat = new three.MeshPhongMaterial({color:0,emissive:team_colors[1],emissiveIntensity:0.001});
const spmat2 = new three.MeshPhongMaterial({color:0,emissive:team_colors[4],emissiveIntensity:0.001});
const spmat3 = new three.MeshPhongMaterial({color:0,emissive:team_colors[2],emissiveIntensity:0.001});
const spmat4 = new three.MeshPhongMaterial({emissive:team_colors[3],emissiveIntensity:0.001});
const spmat_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[1],emissiveIntensity:0.01});
const spmat2_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[4],emissiveIntensity:0.01});
const spmat3_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[2],emissiveIntensity:0.01});
const spmat4_lit = new three.MeshPhongMaterial({emissive:team_colors[3],emissiveIntensity:0.01});
const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:0,emissive:v,emissiveIntensity:0.001}));
const litmats = team_colors.map(v => new three.MeshPhongMaterial({color:0,emissive:v,emissiveIntensity:0.01}));
// const spmat = new three.MeshPhongMaterial({color:team_colors[1],emissive:team_colors[0],emissiveIntensity:0.02});
// const spmat3 = new three.MeshPhongMaterial({color:team_colors[2],emissive:team_colors[2],emissiveIntensity:0.2});
// const spmat4 = new three.MeshPhongMaterial({color:team_colors[3],emissive:team_colors[3],emissiveIntensity:0.2});
// const spmat = new three.MeshNormalMaterial();
// const spmat = new three.MeshDepthMaterial();
// const spmat2 = new three.MeshDistanceMaterial();
// const spmat2 = new three.MeshPhongMaterial({color:0x0000ff,emissive:0x0000ff,emissiveIntensity:0.2});
const sphere1 = new three.Mesh(spgeom, spmat);
const sphere2 = new three.Mesh(spgeom, spmat2);
sphere2.rotation.y = Math.PI;
// sphere2.rotation.z = Math.PI;
const sphere = new three.Group();
sphere.add(sphere1);
sphere.add(sphere2);
// sphere.position.set(-1, -1, 1);
sphere.position.set(0, 0, 0);
// sphere.scale.setScalar(20);
// sphere.rotation.y = Math.PI*5/4;
// sphere.rotation.x = Math.PI/2;
sphere.rotation.y = Math.PI/2;
// scene.add(sphere);
// renderer.render(scene, camera);
console.log("rendered");

const main_group = new three.Group();
const main_light = new three.PointLight(0xffffff);
const amb_light = new three.AmbientLight(0x333333,0.05);
main_light.position.set(0, 5, viewvmax*2);
// main_light.position.set(0, 5, 0);
scene.add(main_light);
scene.add(amb_light);
scene.add(main_group);

// setTimeout(() => {
//     spmat.color.setRGB(0,255,0);
//     renderer.render(scene, camera);
// }, 2000);

const QUARTER = Math.PI/2;
const THIRD = 2*Math.PI/3;

const tile_radius = 0.5;
const tile_geom_bright = new three.SphereGeometry(tile_radius, 32, 32, 0, QUARTER, 0, QUARTER);
const tile_geom_tleft = new three.SphereGeometry(tile_radius, 32, 32, Math.PI, QUARTER, 0, QUARTER);
const tile_geom_tright = new three.SphereGeometry(tile_radius, 32, 32, Math.PI/2, QUARTER, 0, QUARTER);
const tile_geom_bleft = new three.SphereGeometry(tile_radius, 32, 32, 3*Math.PI/2, QUARTER, 0, QUARTER);
const tile_geom_left = new three.SphereGeometry(tile_radius, 32, 32, Math.PI, Math.PI, 0, Math.PI);
const tile_geom_right = new three.SphereGeometry(tile_radius, 32, 32, 0, Math.PI, 0, Math.PI);
const tile_geom_tl3 = new three.SphereGeometry(tile_radius, 32, 32, Math.PI, THIRD, 0, Math.PI);
const tile_geom_tr3 = new three.SphereGeometry(tile_radius, 32, 32, Math.PI/3, THIRD, 0, Math.PI);
const tile_geom_b3 = new three.SphereGeometry(tile_radius, 32, 32, -Math.PI/3, THIRD, 0, Math.PI);

let rows = 5;
let cols = 5;
/**@type {number[]} */
let board = [];
/**@type {number[]} */
let teamboard = [];

/**
 * @param {number} r
 * @param {number} c
 * @param {number} t
 * @param {number} v
 */
function createTile(r, c, t, v) {
    let parts = 4;
    if (r === 0 || r === rows - 1) {
        parts --;
    }
    if (c === 0 || c === cols - 1) {
        parts --;
    }
    let g = new three.Group();
    if (parts === 2) {
        g.add(new three.Mesh(tile_geom_left, litmats[t]));
        g.add(new three.Mesh(tile_geom_right, (v > 1 ? litmats : unlitmats)[t]));
    } else if (parts === 3) {
        g.add(new three.Mesh(tile_geom_tl3, litmats[t]));
        g.add(new three.Mesh(tile_geom_tr3, (v > 1 ? litmats : unlitmats)[t]));
        g.add(new three.Mesh(tile_geom_b3, (v > 2 ? litmats : unlitmats)[t]));
    } else {
        // let otL = ;
        // let otR = ;
        // let obL = ;
        // let obR = ;
        g.add(new three.Mesh(tile_geom_tleft, litmats[t]));
        g.add(new three.Mesh(tile_geom_tright, (v > 1 ? litmats : unlitmats)[t]));
        g.add(new three.Mesh(tile_geom_bleft, (v > 2 ? litmats : unlitmats)[t]));
        g.add(new three.Mesh(tile_geom_bright, (v > 3 ? litmats : unlitmats)[t]));
    }
    g.rotation.y = Math.PI/2;
    g.position.set((c/cols)*(viewhmax-viewhmin) + viewhmin + tile_radius, 0, (r/rows)*(viewvmax-viewvmin) + viewvmin + tile_radius);
    g.userData.index = r*cols + c;
    g.children.forEach(v => {v.userData.index = r*cols + c;});
    // if (r === 2 && c === 2) {
    //     preserveCopy(g.children[0], new three.Mesh(tile_geom_tleft, spmat_lit), "position", "rotation");
    //     console.log(g.position);
    // }
    // g.position.set(0, 0, 0);
    main_group.add(g);
}

/**
 * @param {number} r
 * @param {number} c
 * @param {number} t
 * @param {number} v
 */
function updateTile(r, c, t, v) {
    board[r*cols+c] = v;
    teamboard[r*cols+c] = t;
    const g = main_group.children[r*cols+c];
    let parts = 4;
    if (r === 0 || r === rows - 1) {
        parts --;
    }
    if (c === 0 || c === cols - 1) {
        parts --;
    }
    if (parts === 2) {
        preserveCopy(g.children[0], new three.Mesh(tile_geom_left, litmats[t]), "position", "rotation");
        preserveCopy(g.children[1], new three.Mesh(tile_geom_right, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
    } else if (parts === 3) {
        preserveCopy(g.children[0], new three.Mesh(tile_geom_tl3, litmats[t]), "position", "rotation");
        preserveCopy(g.children[1], new three.Mesh(tile_geom_tr3, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
        preserveCopy(g.children[2], new three.Mesh(tile_geom_b3, (v > 2 ? litmats : unlitmats)[t]), "position", "rotation");
    } else {
        preserveCopy(g.children[0], new three.Mesh(tile_geom_tleft, litmats[t]), "position", "rotation");
        preserveCopy(g.children[1], new three.Mesh(tile_geom_tright, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
        preserveCopy(g.children[2], new three.Mesh(tile_geom_bleft, (v > 2 ? litmats : unlitmats)[t]), "position", "rotation");
        preserveCopy(g.children[3], new three.Mesh(tile_geom_bright, (v > 3 ? litmats : unlitmats)[t]), "position", "rotation");
    }
}

const _keymap = {};
window.addEventListener("blur", () => {
    for (const key in _keymap) {
        delete _keymap[key];
    }
});

document.addEventListener("keydown", (e) => {
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

window.addEventListener("message", (ev) => {
    const data = ev.data;
    // console.log(data);
    switch (data.type) {
        case "3d-flushupdates":{
            renderer.render(scene, camera);
            break;
        }
        case "3d-createboard":{
            rows = data.rows;
            cols = data.cols;
            console.log(rows);
            board = data.board;
            teamboard = data.teamboard;
            container.appendChild(renderer.domElement);
            main_group.clear();
            // createTile(0, 0);
            let i = 0;
            for (let r = 0; r < rows; r ++) {
                for (let c = 0; c < cols; c ++) {
                    createTile(r, c, teamboard[i], board[i]);
                    i ++;
                }
            }
            main_group.scale.x = (viewhmax-viewhmin)/cols;
            main_group.scale.z = (viewvmax-viewvmin)/rows;
            // renderer.render(scene, camera);
            break;
        }
        case "3d-cleanup":{
            container.removeChild(renderer.domElement);
            break;
        }
        case "3d-updatetile":{
            updateTile(data.row, data.col, data.team, data.val);
            // renderer.render(scene, camera);
            break;
        }
        case "3d-resolveclick":{
            // const dir = new three.Vector3(0,0,1).applyEuler(camera.rotation);
            // const dir = new three.Vector3(0,-1,0);
            // const castr = new three.Raycaster(camera.position, dir).intersectObjects(main_group.children, true);
            const caster = new three.Raycaster();
            const pointer = new three.Vector2();
            const pelem = renderer.domElement.parentElement.parentElement.parentElement;
            const elem = renderer.domElement;
            // console.log(`${data.x}-${elem.offsetLeft}/${elem.clientWidth} * 2 - 1`);
            // console.log(`${data.y}-${elem.offsetTop}/${elem.clientHeight} * 2 - 1`);
            pointer.x = (data.x-elem.offsetLeft)/elem.clientWidth * 2 - 1;
            pointer.y = -(data.y-elem.offsetTop)/elem.clientHeight * 2 + 1;
            // pointer.x = (data.x-renderer.domElement.clientLeft)/renderer.domElement.clientWidth * (viewhmax-viewhmin) + viewhmin;
            // pointer.y = (data.y-renderer.domElement.clientTop)/renderer.domElement.clientHeight * (viewvmax-viewvmin) + viewvmin;
            // console.log(pointer);
            caster.setFromCamera(pointer, camera);
            const castr = caster.intersectObjects(main_group.children, true);
            // console.log(castr);
            // console.log(camera.position);
            // console.log(dir);
            // console.log(camera.rotation);
            // console.log(castr);
            let ind = -1;
            if (castr.length) {
                ind = castr[0].object.userData.index;
            }
            // console.log(ind);
            window.postMessage({type:"3d-clickresolve",index:ind});
            break;
        }
        case "3d-exec":{
            if (!allow_exec) {
                alert("WARNING! Attempted use of arbitrary code execution. If you are not a developer attempting to use this feature, immediately close this tab and email the server operator.");
                window.postMessage({type:"terri-secviolation"});
                throw new Error("SECURITY VIOLATION");
            }
            try {
                console.log(eval(data.s));
            } catch (E) {
                console.log(`${E.stack}`);
            }
            break;
        }
    }
});
// window.addEventListener("3d-cleanup", () => {
// });

// window.addEventListener("board-update", () => {});
