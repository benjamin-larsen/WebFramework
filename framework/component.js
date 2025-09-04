import { renderQueue, depManager } from "./render/index.js";
import { FUNCTION_CACHE_LIMIT, INSTANCE_STATES } from "./constants.js";

export class ComponentInstance {
    constructor(vnode, level) {
        this.vnode = vnode;
        this.level = level;
        this.status = INSTANCE_STATES.BEFORE_MOUNT;

        this.data = {};

        this.effects = new Set();
        this.cachedFunctions = new Map();
        this.cacheHistory = [];

        this.callHook("onCreated", this.vnode.properties)
    }

    setStatus(status) {
        if (status === INSTANCE_STATES.UNSYNCED && this.status === INSTANCE_STATES.BEFORE_MOUNT) return;
        if (status === INSTANCE_STATES.BEFORE_MOUNT) return;

        this.status = status;
    }

    callHook(hookName, ...args) {
        if (!this.vnode) return;

        if (typeof this.vnode.component[hookName] === 'function') {
            try {
                this.vnode.component[hookName].apply(
                    this,
                    args
                )
            } catch(e) {
                console.log("Error occured while running Lifecycle Hook", e)
            }
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