const targetMap = new Map()
const effectStack = [];
let bypassCounter = 0;

window.targetMap = targetMap

class Subscription {
    constructor(dep, sub) {
        this.dep = dep;
        this.sub = sub;
        this.isNew = true;
    }
}

class Dependency {
    constructor(target) {
        this.subs = new Map()
        this.target = target;
    }

    subscribe(subscriber) {
        let subscription = this.subs.get(subscriber);
        
        if (!subscription) {
            subscription = new Subscription(this, subscriber)
            this.subs.set(subscriber, subscription)
            subscriber.deps.set(this, subscription)
        } else {
            subscription.isNew = true;
        }
    }
    
    unsubscribe(subscriber) {
        this.subs.delete(subscriber)

        if (this.subs.size === 0) {
            targetMap.delete(this.target)
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

function isTrackingDisabled() {
    if (bypassCounter > 0) return true;
    return false;
}

function subscribe(target, subscriber) {
    let dep = targetMap.get(target)

    if (!dep) {
        dep = new Dependency(target)
        targetMap.set(target, dep)
    }

    dep.subscribe(subscriber)
}

export function track(target) {
    if (isTrackingDisabled()) return;
    if (effectStack.length <= 0) return;

    const subscriber = effectStack[effectStack.length - 1];

    subscribe(target, subscriber)
}

export function trigger(target) {
    const dep = targetMap.get(target)
    if (!dep) return;

    for (const [sub] of dep.subs) {
        sub.onReact()
    }
}

export function withoutTracking(func) {
    bypassCounter++

    try {
        return func()
    } finally {
        bypassCounter--
    }
}

export function withTracking(subscription, func) {
    if (isTrackingDisabled()) throw Error("Fatal Error: Tracking disabled when trying to track new function.")

    subscription.preTracking()
    effectStack.push(subscription)

    try {
        return func()
    } finally {
        effectStack.pop()
        subscription.postTracking()
    }
}