import { BufferGeometry, Object3D } from "three";

/**
 * @typedef PreservableProperty
 * @type {"position"|"rotation"|"scale"|}
 */

/**
 * copies source into target, preserving properties
 * @param {Object3D} target
 * @param {Object3D} source
 * @param  {...PreservableProperty} properties properties to preserve
 */
export function preserveCopy(target, source, ...properties) {
    const d = target.userData;
    let props = {};
    for (const p of properties) {
        props[p] = target[p].clone();
    }
    target.copy(source, false);
    for (const p in props) {
        target[p].copy(props[p]);
    }
    target.userData = d;
}
