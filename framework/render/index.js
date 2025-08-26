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

    withTracking(instance, func) {
        effectStack.push((type, info) => {
            if (type !== "get") return;

            instance.effects.add(info.target)
            depManager.sub(info.target, instance)
        })

        try {
            return func()
        } catch(e) {
            throw e
        } finally {
            effectStack.pop()
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

        const startTime = performance.now()

        for (const componentInstance of items) {
            if (!componentInstance.vnode) continue;

            renderNode(componentInstance.vnode);
        }

        times.push({
            type: "renderQueue",
            time: performance.now() - startTime,
            items
        })

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

window.times = []

export function renderNode(node) {
    if (!node.instance) return;
    
    if (node.constructor === ComponentNode) {
        refreshComponentAnchor(node)
    }

    node.instance.cleanEffects()

    const prevChildren = node.children;

    const startTime_render = performance.now()
    const nextChildren = depManager.withTracking(
        node.instance,
        node.renderFn.bind(
            node.instance,
            node.properties
        )
    )
    times.push({
        type: "render",
        time: performance.now() - startTime_render,
        node
    })

    const startTime_patch = performance.now()
    patch(node, prevChildren, nextChildren);
    times.push({
        type: "patch",
        time: performance.now() - startTime_patch,
        node
    })
}