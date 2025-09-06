import { ComponentNode } from "../vnode.js";
import { refreshComponentAnchor } from "../anchor.js";
import { patch } from "./patching.js";
import { INSTANCE_STATES } from "../constants.js";

class DependencyManager {
    constructor() {
        this.subscriptions = new Map()
        this.trackerStack = [];
        this.trackDisabled = 0;
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

    track(target) {
        if (this.trackDisabled > 0) return;
        if (this.trackerStack.length <= 0) return;
        
        const instance = this.trackerStack[this.trackerStack.length - 1];

        instance.effects.add(target)
        this.sub(target, instance)
    }

    trigger(target) {
        const subscribers = this.subscriptions.get(target)
        if (!subscribers) return;

        for (const sub of subscribers) {
            renderQueue.queue(sub)
        }
    }

    withoutTracking(func) {
        this.trackDisabled++

        try {
            return func()
        } finally {
            this.trackDisabled--
        }
    }

    withTracking(instance, func) {
        this.trackerStack.push(instance)

        try {
            return func()
        } finally {
            this.trackerStack.pop()
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
        component.setStatus(INSTANCE_STATES.UNSYNCED);

        this.waiting.add(component)

        if (!this.renderId) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        }
    }
}

export const depManager = new DependencyManager()
export const renderQueue = new RenderQueue()

export function renderNode(node, force) {
    if (!node.instance) return;
    if (!force && node.instance.status === INSTANCE_STATES.SYNCED) return;

    const startTime = performance.now()
    
    if (node.constructor === ComponentNode) {
        refreshComponentAnchor(node)
    }

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

    node.instance.callHook(node.instance.status === INSTANCE_STATES.BEFORE_MOUNT ? "onMounted" : "onUpdated", node.properties || {})
    node.instance.setStatus(INSTANCE_STATES.SYNCED)

    console.log(performance.now() - startTime, node)
}