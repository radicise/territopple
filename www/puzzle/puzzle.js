const topology = new class{
    #m=null;
    set m(v){if(this.#m===null){this.#m=v;}}
    /**@returns {typeof import("../../topology/topology.js")} */
    get m(){return this.#m;}
}();
const loadPromise = new Promise((res,) => {
    import("topology/topology.js").then(r => {topology.m = r;res(r);},r => {throw new Error("could not load topology module");});
});

async function parseBoard() {}
