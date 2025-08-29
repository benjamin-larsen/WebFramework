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
        const items = [...this.waiting].filter(inst => inst.vnode).sort((a, b) => a.level - b.level);
        this.waiting.clear();

        for (const componentInstance of items) {
            if (!componentInstance.vnode) continue;

            renderNode(componentInstance.vnode);
        }

        if (this.waiting.size > 0) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        } else {
            this.renderId = null;
        }
    }

    queue(component) {
        component.dirty = true;

        this.waiting.add(component)

        if (!this.renderId) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        }
    }
}

export const effectStack = new EffectStack()
export const depManager = new DependencyManager()
export const renderQueue = new RenderQueue()

export function renderNode(node, force) {
    if (!node.instance) return;
    if (!force && !node.instance.dirty) return;

    const startTime = performance.now()
    
    if (node.constructor === ComponentNode) {
        refreshComponentAnchor(node)
    }

    node.instance.dirty = false;
    node.instance.cleanEffects()

    const prevChildren = node.children;

    const nextChildren = depManager.withTracking(
        node.instance,
        node.component.render.bind(
            node.instance,
            node.properties
        )
    )

    patch(node, prevChildren, nextChildren, node.instance.level);

    console.log(performance.now() - startTime, node)
}