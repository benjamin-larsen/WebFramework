import { ComponentNode } from "../vnode.js";
import { refreshComponentAnchor } from "../anchor.js";
import { patch } from "./patching.js";
import { INSTANCE_STATES } from "../constants.js";

class Subscription {
    constructor(dep, sub) {
        this.dep = dep;
        this.sub = sub;
        this.isNew = true;
    }
}

class Dependency {
    constructor() {
        this.subs = new Map()
    }

    subscribe(subscriber) {
        let subscription = this.subs.get(subscriber);
        
        if (!subscription) {
            console.log("Subscribe", this, subscriber)
            subscription = new Subscription(this, subscriber)
            this.subs.set(subscriber, subscription)
            subscriber.deps.set(this, subscription)
        } else {
            console.log("Confirm Subscription", this, subscriber)
            subscription.isNew = true;
        }
    }
    
    unsubscribe(subscriber) {
        console.log("Unsubscribe", this, subscriber)
        this.subs.delete(subscriber)

        if (this.subs.size === 0) {
            // remove me
        }
    }
}

export class DependencySubscriber {
    constructor(onReact) {
        this.onReact = onReact;
        this.deps = new Map();
    }

    preTracking() {
        for (const [_, subscription] of this.deps) {
            subscription.isNew = false;
        }
    }

    postTracking() {
        for (const [dep, subscription] of this.deps) {
            if (!subscription.isNew) {
                dep.unsubscribe(this)
                this.deps.delete(dep)
            }
        }
    }

    destroy() {
        for (const [dep] of this.deps) {
            dep.unsubscribe(this)
        }

        this.deps = null;
        this.onReact = null;
    }
}

class DependencyManager {
    constructor() {
        this.subscriptions = new WeakMap()
        this.trackerStack = [];
        this.trackDisabled = 0;
    }

    isTrackingDisabled() {
        if (this.trackDisabled > 0) return true;
        return false;
    }

    sub(target, func) {
        let dep = this.subscriptions.get(target)

        if (!dep) {
            dep = new Dependency()
            this.subscriptions.set(target, dep)
        }

        dep.subscribe(func)
    }

    track(target) {
        if (this.isTrackingDisabled()) return;
        if (this.trackerStack.length <= 0) return;
        
        const instance = this.trackerStack[this.trackerStack.length - 1];

        this.sub(target, instance)
    }

    trigger(target) {
        const dep = this.subscriptions.get(target)
        if (!dep) return;

        for (const [sub] of dep.subs) {
            sub.onReact()
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

    withTracking(subscription, func) {
        if (this.isTrackingDisabled()) throw Error("Fatal Error: Tracking disabled when trying to track new function.")

        subscription.preTracking()
        this.trackerStack.push(subscription)

        try {
            return func()
        } finally {
            this.trackerStack.pop()
            subscription.postTracking()
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

    const prevChildren = node.children;

    const nextChildren = depManager.withTracking(
        node.instance.subscriber,
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