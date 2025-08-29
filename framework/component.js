import { renderQueue, depManager } from "./render/index.js";
import { FUNCTION_CACHE_LIMIT } from "./constants.js";

export class ComponentInstance {
    constructor(vnode, level) {
        this.vnode = vnode;
        this.level = level;
        this.dirty = false;

        this.data = {};

        this.effects = new Set();
        this.cachedFunctions = new Map();
        this.cacheHistory = [];

        if (typeof this.vnode.component.instanceSetup === "function") {
            this.vnode.component.instanceSetup.call(
                this,
                this.vnode.properties
            )
        }
    }

    getFn(key, func, force = false) {
        if (!force && this.cachedFunctions.has(key)) return this.cachedFunctions.get(key);

        // In Future: probably evict based on lowest usage count
        if (this.cacheHistory.length >= FUNCTION_CACHE_LIMIT) {
            const evicted = this.cacheHistory.shift()
            this.cachedFunctions.delete(evicted)
        }

        this.cacheHistory.push(key)
        this.cachedFunctions.set(key, func);
        return func;
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