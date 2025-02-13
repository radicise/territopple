/**@type {HTMLDivElement} */
const container = document.getElementById("gameboard");
/**@type {HTMLInputElement} */
const slider = document.getElementById("board-zoom");

const foo = {_m:0, get m(){return this._m;}, set m(v){changeMethod(this._m, v);this._m=v;}};

/**
 * @param {number} o
 * @param {number} n
 */
function changeMethod(o, n) {
    if (o === n) return;
    switch (o) {
        case 0:break;
        case 1:
            container.classList.remove("m1");
            break;
        case 2:
            container.classList.remove("m2");
            slider.hidden = true;
            break;
    }
    switch (n) {
        case 0:break;
        case 1:
            container.classList.add("m1");
            break;
        case 2:
            container.classList.add("m2");
            slider.hidden = false;
            break;
    }
}

let moving = false;
let down = false;
let origin = null;
let corigin = null;
container.addEventListener("mousedown", (ev) => {
    if (foo.m !== 2) return;
    down = true;
    origin = [ev.clientX, ev.clientY];
    corigin = [parseFloat(container.style.getPropertyValue("--dx")||"0"), parseFloat(container.style.getPropertyValue("--dy")||"0")];
    // corigin = [0,0];
    // console.log(origin, corigin);
    container.style.setProperty("--disabled", "0");
});
document.addEventListener("mouseup", () => {
    if (foo.m !== 2) return;
    down = false;
    moving = false;
    container.style.setProperty("--dx", Math.round(parseFloat(container.style.getPropertyValue("--dx")||"0")/60)*60);
    container.style.setProperty("--dy", Math.round(parseFloat(container.style.getPropertyValue("--dy")||"0")/60)*60);
    // if (parseInt(slider.value) <= 7) container.style.setProperty("--disabled", "0");
});
document.addEventListener("mousemove", (ev) => {
    if (foo.m !== 2) return;
    if (!down) return;
    moving = true;
    container.style.setProperty("--disabled", "1");
    const sf = parseFloat(container.style.getPropertyValue("--sf")||"1");
    container.style.setProperty("--dx", ((ev.clientX-origin[0])*sf+corigin[0]));
    container.style.setProperty("--dy", ((ev.clientY-origin[1])*sf+corigin[1]));
    // console.log(corigin, origin, [ev.clientX, ev.clientY], (ev.clientX-origin[0])+corigin[0], (ev.clientY-origin[1])+corigin[1]);
});
container.addEventListener("wheel", (ev) => {
    if (foo.m !== 2) return;
    if (ev.deltaY === 0) return;
    const speed = 2;
    // const csf = parseFloat(container.style.getPropertyValue("--sf")||"1");
    // console.log(csf, csf+(speed*Math.sign(ev.deltaY)), speed*Math.sign(ev.deltaY), container.style.getPropertyValue("--sf"));
    const z = Math.min(15, Math.round(Math.max(1, parseFloat(container.style.getPropertyValue("--sf")||"1") + (speed*Math.sign(ev.deltaY)))/2)*2-1);
    slider.value = z;
    if (z > 7) container.style.setProperty("--disabled", "1");
    else container.style.setProperty("--disabled", "0");
    container.style.setProperty("--sf", z);
    ev.preventDefault();
    return false;
});
slider.addEventListener("input", () => {
    container.style.setProperty("--sf", slider.value);
    if (parseInt(slider.value) > 7) {
        container.style.setProperty("--disabled", "1");
    }
});
document.addEventListener("keydown", (e) => {
    let dx = 0;
    let dy = 0;
    switch (e.code) {
        case"KeyA":dx=1;break;
        case"KeyD":dx=-1;break;
        case"KeyW":dy=1;break;
        case"KeyS":dy=-1;break;
        case"KeyF":container.style.setProperty("--dx", "0");container.style.setProperty("--dy", "0");return;
    }
    const speed = 10;
    container.style.setProperty("--dx", Math.max(-10000, parseFloat(container.style.getPropertyValue("--dx")||"0")+dx*speed));
    container.style.setProperty("--dy", Math.max(-10000, parseFloat(container.style.getPropertyValue("--dy")||"0")+dy*speed));
});

document.getElementById("m0").onclick = ()=>{foo.m=0;};
document.getElementById("m1").onclick = ()=>{foo.m=1;};
document.getElementById("m2").onclick = ()=>{foo.m=2;};

// foo.m = 2;
