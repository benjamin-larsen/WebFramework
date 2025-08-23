import { ComponentNode } from "../vnode.js";
import { refreshComponentAnchor } from "../anchor.js";
import { patch } from "./patching.js";

class EffectStack {
    constructor() {
        this.stack = [];
    }

    push(func) {
        this.stack.push(func)
    }

    pop() {
        this.stack.pop()
    }

    getActiveEffect() {
        if (this.stack.length >= 1) {
            // get top of stack
            return this.stack[this.stack.length - 1]
        }

        return null
    }
}

class DependencyManager {
    constructor() {
        this.subscriptions = new Map()
    }

    sub(target, func) {
        let subscribers = this.subscriptions.get(target)

        if (!subscribers) {
            subscribers = new Set()
            this.subscriptions.set(target, subscribers)
        }

        subscribers.add(func)
    }

    unsub(target, func) {
        const subscribers = this.subscriptions.get(target)
        if (!subscribers) return;

        subscribers.delete(func)

        if (subscribers.size === 0) {
            this.subscriptions.delete(target)
        }
    }

    trigger(target) {
        const subscribers = this.subscriptions.get(target)
        if (!subscribers) return;

        for (const sub of subscribers) {
            renderQueue.queue(sub)
        }
    }
}

class RenderQueue {
    constructor() {
        this.waiting = new Set();
        this.renderId = null;
    }

    process() {
        const items = [...this.waiting];
        this.waiting.clear();

        for (const componentInstance of items) {
            if (!componentInstance.vnode) continue;

            runRender(componentInstance.vnode);
        }

        if (this.waiting.size > 0) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        } else {
            this.renderId = null;
        }
    }

    queue(component) {
        this.waiting.add(component)

        if (!this.renderId) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        }
    }
}

export const effectStack = new EffectStack()
export const depManager = new DependencyManager()
export const renderQueue = new RenderQueue()

export function runRender(component) {
    const startTime = performance.now()

    if (!component.instance) return;
    
    if (component instanceof ComponentNode) {
        refreshComponentAnchor(component)
    }

    component.instance.cleanEffects()

    effectStack.push((type, info) => {
        if (type !== "get") return;

        component.instance.effects.add(info.target)
        depManager.sub(info.target, component.instance)
    })

    const oldChildren = component.children;

    const rendered = component.renderFn.call(component.instance, component.properties)

    patch(component, oldChildren, rendered);

    effectStack.pop()

    console.log("Render Time", performance.now() - startTime, component)
}