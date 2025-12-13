import * as three from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
// import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { preserveCopy } from "./render_helper/updater.js";

// console.log("done loading 3d render script");

const bgColor = new three.Color(200,200,200);

const lit_team_colors = [new three.Color(30,30,30),new three.Color(175,0,0),new three.Color(0,20,175),new three.Color(0xbf,0,0xbf),new three.Color(0,0xbf,0xbf),new three.Color(0xbf,0xbf,0),new three.Color(0x35,0x8f,0x3b)];
const unlit_team_colors = [new three.Color(200,200,200),new three.Color(255,0,0),new three.Color(0,0,255),new three.Color(0xbf,0,0xbf),new three.Color(0,0xbf,0xbf),new three.Color(0xbf,0xbf,0),new three.Color(0x35,0x8f,0x3b)];
// const team_colors = [new three.Color(0,0,0),new three.Color(255,0,0),new three.Color(0,0,255),new three.Color(0xbf,0,0xbf),new three.Color(0,0xbf,0xbf),new three.Color(0xbf,0xbf,0)];
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
// scene.background = new three.Color(255,255,255);
scene.background = bgColor;
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

// suppress right-click menu
renderer.domElement.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    return false;
});

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
        // renderer.render(scene, camera);
        renderScene();
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

// const spgeom = new three.SphereGeometry(1, 32, 32, 0, Math.PI, 0, Math.PI);
// const spgeom = new three.BoxGeometry(5,5,5);
// const spmat = new three.MeshPhongMaterial({color:new three.Color(0,255,0)});
// const spmat3 = new three.MeshPhongMaterial({color:new three.Color(0,0,255)});
// const spmat4 = new three.MeshPhongMaterial({color:new three.Color(255,0,255)});
// const spmat = new three.MeshPhongMaterial({color:0,emissive:team_colors[1],emissiveIntensity:0.001});
// const spmat2 = new three.MeshPhongMaterial({color:0,emissive:team_colors[4],emissiveIntensity:0.001});
// const spmat3 = new three.MeshPhongMaterial({color:0,emissive:team_colors[2],emissiveIntensity:0.001});
// const spmat4 = new three.MeshPhongMaterial({emissive:team_colors[3],emissiveIntensity:0.001});
// const spmat_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[1],emissiveIntensity:0.01});
// const spmat2_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[4],emissiveIntensity:0.01});
// const spmat3_lit = new three.MeshPhongMaterial({color:0,emissive:team_colors[2],emissiveIntensity:0.01});
// const spmat4_lit = new three.MeshPhongMaterial({emissive:team_colors[3],emissiveIntensity:0.01});
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:0,emissive:v,emissiveIntensity:0.001}));
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:0,emissive:team_colors[0],emissiveIntensity:0.001}));
const darkmat = new three.MeshBasicMaterial({color:0});
// const unlitmats = team_colors.map(v => new three.MeshBasicMaterial({color:v}));
// const unlitmats = team_colors.map(v => new three.MeshBasicMaterial({color:0,transparent:true,opacity:0}));
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:v,transparent:true,opacity:0.5,vertexColors:true}));
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:v,emissive:v,emissiveIntensity:0.01,vertexColors:true}));
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:v,emissive:v,emissiveIntensity:0.01}));
// const unlitmats = team_colors.map(v => new three.MeshPhongMaterial({color:v}));
const unlitmats = unlit_team_colors.map(v => new three.MeshLambertMaterial({color:v}));
// const litmats = team_colors.map(v => new three.MeshPhongMaterial({color:0,emissive:v,emissiveIntensity:0.01}));
// const litmats = team_colors.map(v => new three.MeshPhongMaterial({color:v,emissive:v,emissiveIntensity:0.01,vertexColors:true}));
const litmats = lit_team_colors.map(v => new three.MeshLambertMaterial({color:v,emissive:v,emissiveIntensity:0.01,vertexColors:true}));
// const litmats = team_colors.map(v => new three.MeshPhongMaterial({color:v,vertexColors:true}));
// const spmat = new three.MeshPhongMaterial({color:team_colors[1],emissive:team_colors[0],emissiveIntensity:0.02});
// const spmat3 = new three.MeshPhongMaterial({color:team_colors[2],emissive:team_colors[2],emissiveIntensity:0.2});
// const spmat4 = new three.MeshPhongMaterial({color:team_colors[3],emissive:team_colors[3],emissiveIntensity:0.2});
// const spmat = new three.MeshNormalMaterial();
// const spmat = new three.MeshDepthMaterial();
// const spmat2 = new three.MeshDistanceMaterial();
// const spmat2 = new three.MeshPhongMaterial({color:0x0000ff,emissive:0x0000ff,emissiveIntensity:0.2});
// const sphere1 = new three.Mesh(spgeom, spmat);
// const sphere2 = new three.Mesh(spgeom, spmat2);
// sphere2.rotation.y = Math.PI;
// sphere2.rotation.z = Math.PI;
// const sphere = new three.Group();
// sphere.add(sphere1);
// sphere.add(sphere2);
// sphere.position.set(-1, -1, 1);
// sphere.position.set(0, 0, 0);
// sphere.scale.setScalar(20);
// sphere.rotation.y = Math.PI*5/4;
// sphere.rotation.x = Math.PI/2;
// sphere.rotation.y = Math.PI/2;
// scene.add(sphere);
// renderer.render(scene, camera);
// console.log("rendered");

const main_group = new three.Group();
const main_light = new three.PointLight(0xffffff,0.5);
const MAIN_LIGHT_HEIGHT = 5;
const MAIN_LIGHT_RADIUS = viewvmax;
// const amb_light = new three.AmbientLight(0x333333,0.2);
const amb_light = new three.AmbientLight(0x333333,0.1);
main_light.position.set(0, MAIN_LIGHT_HEIGHT, MAIN_LIGHT_RADIUS);
// main_light.position.set(0, 5, 0);
// scene.add(main_light);
scene.add(amb_light);
scene.add(main_group);
// main_group.material = darkmat;

const tile_radius = 0.5;
const tile_spacing = tile_radius/2;

const radial_markers = new three.Group();
// radial_markers.material = darkmat;
{
    const radial_geom = new three.SphereGeometry(tile_radius/4);
    // up, down, left, right, front, back
    const radial_colors = [new three.Color(0, 255, 255), new three.Color(255, 0, 255), new three.Color(255,0,0), new three.Color(0,255,0), new three.Color(0, 0, 255), new three.Color(255, 255, 0)];
    const radial_positions = [[0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
    for (let i = 0; i < 6; i ++) {
        const s = new three.Mesh(radial_geom, new three.MeshBasicMaterial({color:radial_colors[i],depthTest:false,opacity:0.9,transparent:true}));
        // const s = new three.Mesh(radial_geom, new three.MeshBasicMaterial({color:radial_colors[i],depthTest:false}));
        s.position.set(...radial_positions[i]);
        radial_markers.add(s);
    }
    scene.add(radial_markers);
}

/*
the following code pertaining to bloom has been derived from user prisoner849 on the three.js forums
original post here: https://discourse.threejs.org/t/how-to-use-bloom-effect-not-for-all-object-in-scene/24244/13
*/
renderer.toneMapping = three.ReinhardToneMapping;
renderer.toneMappingExposure = 1;
const renderScenePass = new RenderPass(scene, camera);

const params = {
    exposure: 1,
    // bloomStrength: 0.25,
    bloomStrength: 0.5,
    bloomThreshold: 0,
    bloomRadius: 0
};

const bloomPass = new UnrealBloomPass(new three.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScenePass);
bloomComposer.addPass(bloomPass);

/*
varying vec2 vUv;

void main() {

    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
*/
const vertexShaderCode = "varying vec2 vUv;\n\nvoid main() {\n\n    vUv = uv;\n\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\n}\n";
/*
uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;

varying vec2 vUv;

void main() {

    gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );

}
*/
const fragmentShaderCode = "uniform sampler2D baseTexture;\nuniform sampler2D bloomTexture;\n\nvarying vec2 vUv;\n\nvoid main() {\n\ngl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );\n\n}\n";

const finalPass = new ShaderPass(
    new three.ShaderMaterial( {
        uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: vertexShaderCode,
        fragmentShader: fragmentShaderCode,
        defines: {}
    }), "baseTexture"
);
finalPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScenePass);
finalComposer.addPass(finalPass);
let doBloom = true;

function renderScene() {
    if (!doBloom) {
        scene.background.set(0xf0f0f0);
        renderer.render(scene, camera);
        return;
    }
    // scene.background = new three.Color(0,0,0);
    scene.background.set(0);
    main_group.traverse((o) => {
        if (!o.isGroup && !o.layers.isEnabled(1)) {
            o.material = darkmat;
        }
    });
    let mats = [null,null,null,null,null,null];
    radial_markers.children.forEach((o, i) => {
        mats[i] = o.material;
        o.material = darkmat;
    });
    bloomComposer.render();
    // scene.background = new three.Color(255,255,255);
    // scene.background.set(0x707070);
    scene.background.set(0xa0a0a0);
    // scene.background.set(...bgColor.toArray());
    main_group.traverse((o) => {
        // if (!o.isGroup)console.log(o.userData.matindex);
        if (!o.isGroup && !o.layers.isEnabled(1)) {
            o.material = (o.userData.lit?litmats:unlitmats)[o.userData.matindex];
            // o.material = litmats[o.userData.matindex];
        }
    });
    radial_markers.children.forEach((o, i) => {
        o.material = mats[i];
    });
    finalComposer.render();
}
/*
end derived code
*/

// setTimeout(() => {
//     spmat.color.setRGB(0,255,0);
//     renderer.render(scene, camera);
// }, 2000);

const QUARTER = Math.PI/2;
const THIRD = 2*Math.PI/3;

const tile_geom_bright = new three.SphereGeometry(tile_radius, 32, 32, 0, QUARTER, 0, Math.PI);
const tile_geom_tleft = new three.SphereGeometry(tile_radius, 32, 32, Math.PI, QUARTER, 0, Math.PI);
const tile_geom_tright = new three.SphereGeometry(tile_radius, 32, 32, Math.PI/2, QUARTER, 0, Math.PI);
const tile_geom_bleft = new three.SphereGeometry(tile_radius, 32, 32, 3*Math.PI/2, QUARTER, 0, Math.PI);
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
    g.position.set((c/cols)*(viewhmax-viewhmin) + viewhmin + tile_radius + (tile_spacing * (c - (cols-1)/2)), 0, (r/rows)*(viewvmax-viewvmin) + viewvmin + tile_radius + (tile_spacing * (r - (rows-1)/2)));
    g.userData.index = r*cols + c;
    g.children.forEach((o,i) => {o.userData.index = r*cols + c;o.userData.matindex=t;o.userData.lit=(v>i);if(v>i){o.layers.enable(1);}});
    // g.children.forEach(v => {v.userData.index = r*cols + c;v.userData.matindex=t;});
    // g.material = darkmat;
    // if (r === 2 && c === 2) {
    //     preserveCopy(g.children[0], new three.Mesh(tile_geom_tleft, spmat_lit), "position", "rotation");
    //     console.log(g.position);
    // }
    // g.position.set(0, 0, 0);
    main_group.add(g);
    return g;
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
    g.children.forEach((o, i) => {o.material = ((v>i)?litmats:unlitmats)[t];o.userData.lit=v>i;o.userData.matindex=t;if (v > i){o.layers.enable(1);}else{o.layers.disable(1);}});
    // g.children.forEach((o, i) => {o.material = litmats[t];o.userData.matindex=t;o.userData.lit=v>=i;if (v >= i){o.layers.enable(1);}else{o.layers.disable(1);}});
    if (parts === 2) {
        // preserveCopy(g.children[0], new three.Mesh(tile_geom_left, litmats[t]), "position", "rotation");
        // preserveCopy(g.children[1], new three.Mesh(tile_geom_right, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
        // g.children[0].material = litmats[t];
        // g.children[1].material = litmats[t];
        // preserveCopy(g.children[1], new three.Mesh(tile_geom_right, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
    } else if (parts === 3) {
        // preserveCopy(g.children[0], new three.Mesh(tile_geom_tl3, litmats[t]), "position", "rotation");
        // preserveCopy(g.children[1], new three.Mesh(tile_geom_tr3, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
        // preserveCopy(g.children[2], new three.Mesh(tile_geom_b3, (v > 2 ? litmats : unlitmats)[t]), "position", "rotation");
    } else {
        // preserveCopy(g.children[0], new three.Mesh(tile_geom_tleft, litmats[t]), "position", "rotation");
        // preserveCopy(g.children[1], new three.Mesh(tile_geom_tright, (v > 1 ? litmats : unlitmats)[t]), "position", "rotation");
        // preserveCopy(g.children[2], new three.Mesh(tile_geom_bleft, (v > 2 ? litmats : unlitmats)[t]), "position", "rotation");
        // preserveCopy(g.children[3], new three.Mesh(tile_geom_bright, (v > 3 ? litmats : unlitmats)[t]), "position", "rotation");
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

let rot_mouse_sensitivity = 1.0;
let rot_key_sensitivity = 1.0;
let reftime, clearid;

window.addEventListener("message", (ev) => {
    const data = ev.data;
    // console.log(data);
    switch (data.type) {
        case "3d-flushupdates":{
            // renderer.render(scene, camera);
            renderScene();
            break;
        }
        case "3d-createboard":{
            rows = data.rows;
            cols = data.cols;
            // console.log(rows);
            board = data.board;
            teamboard = data.teamboard;
            container.appendChild(renderer.domElement);
            main_group.clear();
            // createTile(0, 0);
            let i = 0;
            // let x = viewhmin;
            // let z = viewvmin;
            let x = viewhmin-(tile_spacing*(cols-5)*2.5);
            let z = viewvmin-(tile_spacing*(rows-5)*2.5);
            for (let r = 0; r < rows; r ++) {
                for (let c = 0; c < cols; c ++) {
                    const g = createTile(r, c, teamboard[i], board[i]);
                    g.position.set(x, 0, z);
                    x += 1 + tile_spacing;
                    i ++;
                }
                x = viewhmin-(tile_spacing*(cols-5)*2.5);
                // x = viewhmin;
                z += 1 + tile_spacing;
            }
            // main_group.scale.x = (viewhmax-viewhmin)/(cols);
            // main_group.scale.z = (viewvmax-viewvmin)/(rows);
            // main_group.scale.x = 3/(cols);
            // main_group.scale.z = 3/(rows);
            // main_group.scale.x = (viewhmax-viewhmin)/(cols+(tile_spacing*cols));
            // main_group.scale.z = (viewvmax-viewvmin)/(rows+(tile_spacing*rows));
            const sv = Math.min((viewhmax-viewhmin)/(cols+(tile_spacing*cols)), (viewvmax-viewvmin)/(rows+(tile_spacing*rows)));
            // main_group.scale.set();
            main_group.scale.x = sv;
            main_group.scale.y = sv;
            main_group.scale.z = sv;
            // renderer.render(scene, camera);
            if (clearid) clearInterval(clearid);
            reftime = performance.now();
            clearid = setInterval(keyControls, 17);
            break;
        }
        case "3d-cleanup":{
            if (clearid) clearInterval(clearid);
            // console.log(renderer.domElement.parentNode);
            if (renderer.domElement.parentNode) {
                container.removeChild(renderer.domElement);
            }
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
        case "3d-sensitivity":{
            rot_mouse_sensitivity = data.rot_mouse||rot_mouse_sensitivity;
            rot_key_sensitivity = data.rot_key||rot_key_sensitivity;
            break;
        }
        case "3d-setbloom":{
            doBloom = data.enabled;
            renderScene();
            break;
        }
    }
});
let drag_down = false;
const init_pos = new three.Vector2();
// let cam_curr_el = 0; // camera elevation
// let cam_curr_az = 0; // camera azimuth
// rotations are <azimuth, elevation>
let cam_curr_rot = new three.Vector2(-Math.PI/2, Math.PI/2);
let cam_temp_rot = new three.Vector2(-Math.PI/2, Math.PI/2);
const elem = renderer.domElement;
camera.rotation.order = "YXZ";

// const MOUSE_ROT_SPEED = 1.0;
const KEY_ROT_SPEED = 0.05;

function setCameraRotation() {
    camera.rotation.x = -cam_temp_rot.y;
    camera.rotation.y = cam_temp_rot.x+Math.PI/2;
    camera.position.set(0, 0, 0);
    const v = camera.localToWorld(new three.Vector3(0, 0, 5));
    camera.position.set(v.x, v.y, v.z);
    main_light.position.set(MAIN_LIGHT_RADIUS*Math.cos(cam_temp_rot.x), MAIN_LIGHT_HEIGHT, -MAIN_LIGHT_RADIUS*Math.sin(cam_temp_rot.x));
    // renderer.render(scene, camera);
    renderScene();
}

function keyControls() {
    let time;
    {const ntime = performance.now();time=ntime-reftime;reftime=ntime;}
    if (drag_down) return;
    const delta = new three.Vector2();
    if("ArrowUp" in _keymap)delta.add(new three.Vector2(0, 1));
    if("ArrowDown" in _keymap)delta.add(new three.Vector2(0, -1));
    if("ArrowRight" in _keymap)delta.add(new three.Vector2(1, 0));
    if("ArrowLeft" in _keymap)delta.add(new three.Vector2(-1, 0));
    if("ShiftLeft" in _keymap || "ShiftRight" in _keymap)delta.multiplyScalar(0.25);
    // if no delta, don't re-render
    if (delta.lengthSq() === 0) return;
    delta.multiplyScalar(KEY_ROT_SPEED*rot_key_sensitivity);
    cam_temp_rot.add(delta);
    cam_curr_rot.add(delta);
    setCameraRotation();
    // if("KeyU" in _keymap)line.rotateX(time*Math.PI/180);
    // if("KeyI" in _keymap)line.rotateY(time*Math.PI/180);
    // if("KeyO" in _keymap)line.rotateZ(time*Math.PI/180);
    // if("KeyJ" in _keymap)preserveCopy(line, new three.Line(geom, new three.LineDashedMaterial({color:0xff0000,linewidth:1,gapSize:10,dashSize:1})), "position", "rotation", "scale");
    // if("KeyK" in _keymap)preserveCopy(line2, new three.Line(geom, new three.LineDashedMaterial({color:0x0000ff,linewidth:1,gapSize:10,dashSize:1})), "position", "rotation", "scale");
}

document.addEventListener("mousemove", (ev) => {
    if (!elem.parentElement) return;
    if (drag_down) {
        const curr_pos = new three.Vector2();
        curr_pos.x = (ev.clientX-elem.offsetLeft)/elem.clientWidth * 2 - 1;
        curr_pos.y = -(ev.clientY-elem.offsetTop)/elem.clientHeight * 2 + 1;
        cam_temp_rot.x = cam_curr_rot.x + (init_pos.x - curr_pos.x) * rot_mouse_sensitivity;
        cam_temp_rot.y = cam_curr_rot.y + (init_pos.y - curr_pos.y) * rot_mouse_sensitivity;
        setCameraRotation();
        // // let cam_az_rad = 5*Math.cos(cam_temp_rot.y);
        // // camera.position.set(cam_az_rad*Math.cos(cam_temp_rot.x), 5*Math.sin(cam_temp_rot.y), cam_az_rad*Math.sin(cam_temp_rot.x));
        // camera.rotation.x = -cam_temp_rot.y;
        // camera.rotation.y = cam_temp_rot.x+Math.PI/2;
        // // camera.rotation.y = Math.PI-(cam_temp_rot.x+Math.PI/2);
        // camera.position.set(0, 0, 0);
        // const v = camera.localToWorld(new three.Vector3(0, 0, 5));
        // camera.position.set(v.x, v.y, v.z);
        // // camera.lookAt(0, 0, 0);
        // // camera.rotation.z = 0;
        // renderer.render(scene, camera);
    }
});
document.addEventListener("keyup", (ev) => {
    if (!elem.parentElement) return;
    if (ev.code === "KeyR") {
        if (drag_down) return;
        camera.rotation.x = -Math.PI/2;
        camera.rotation.y = 0;
        camera.rotation.z = 0;
        camera.position.set(0, 5, 0);
        cam_curr_rot.set(-Math.PI/2, Math.PI/2);
        cam_temp_rot.set(-Math.PI/2, Math.PI/2);
        main_light.position.set(0, MAIN_LIGHT_HEIGHT, MAIN_LIGHT_RADIUS);
        // renderer.render(scene, camera);
        renderScene();
    }
});
renderer.domElement.addEventListener("mousedown", (ev) => {
    // console.log("MDOWN", ev.button);
    if (ev.button === 2) {
        drag_down = true;
        init_pos.x = (ev.clientX-elem.offsetLeft)/elem.clientWidth * 2 - 1;
        init_pos.y = -(ev.clientY-elem.offsetTop)/elem.clientHeight * 2 + 1;
        cam_curr_rot.x = cam_temp_rot.x;
        cam_curr_rot.y = cam_temp_rot.y;
    }
});
document.addEventListener("mouseup", (ev) => {
    if (ev.button === 2) {
        drag_down = false;
    }
});
window.addEventListener("blur", () => {
    drag_down = false;
});
// window.addEventListener("3d-cleanup", () => {
// });

// window.addEventListener("board-update", () => {});
