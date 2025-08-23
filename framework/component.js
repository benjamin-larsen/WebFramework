import { renderQueue, depManager } from "./render/index.js";

export class ComponentInstance {
    constructor(vnode) {
        this.vnode = vnode;

        this.effects = new Set();
    }

    $forceUpdate() {
        renderQueue.queue(this)
    }

    cleanEffects() {
        for (const effect of this.effects) {
            depManager.unsub(effect, this);
        }

        this.effects.clear()
    }

    destroy() {
        this.cleanEffects()
        this.vnode = null;
    }
}