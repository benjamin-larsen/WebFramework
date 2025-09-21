const targetMap = new Map();
let activeEffect = null;
let bypassCounter = 0;

let currentRoot = null; // Current Root is the Render Queue being triggered, no need to make stack as they should be done one-by-one.
let currentInstance = null;

export function getCurrentRoot() {
  return currentRoot;
}

export function setCurrentRoot(root) {
  currentRoot = root;
}

export function getCurrentInstance() {
  return currentInstance;
}

export function setCurrentInstance(inst) {
  const prev = currentInstance;
  currentInstance = inst;
  return prev;
}

class Subscription {
  constructor(dep, sub) {
    this.dep = dep;
    this.sub = sub;
    this.isNew = true;
  }
}

class Dependency {
  constructor(target) {
    this.subs = new Map();
    this.target = target;
  }

  subscribe(subscriber) {
    let subscription = this.subs.get(subscriber);

    if (!subscription) {
      subscription = new Subscription(this, subscriber);
      this.subs.set(subscriber, subscription);
      subscriber.deps.set(this, subscription);
    } else {
      subscription.isNew = true;
    }
  }

  unsubscribe(subscriber) {
    this.subs.delete(subscriber);

    if (this.subs.size === 0) {
      targetMap.delete(this.target);
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
        dep.unsubscribe(this);
        this.deps.delete(dep);
      }
    }
  }

  destroy() {
    for (const [dep] of this.deps) {
      dep.unsubscribe(this);
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
  let dep = targetMap.get(target);

  if (!dep) {
    dep = new Dependency(target);
    targetMap.set(target, dep);
  }

  dep.subscribe(subscriber);
}

export function track(target) {
  if (isTrackingDisabled()) return;
  if (!activeEffect) return;

  subscribe(target, activeEffect);
}

export function trigger(target) {
  const dep = targetMap.get(target);
  if (!dep) return;

  for (const [sub] of dep.subs) {
    sub.onReact();
  }
}

export function withoutTracking(func) {
  bypassCounter++;

  try {
    return func();
  } finally {
    bypassCounter--;
  }
}

export function withTracking(subscription, func) {
  if (isTrackingDisabled())
    throw Error(
      'Fatal Error: Tracking disabled when trying to track new function.'
    );

  subscription.preTracking();

  const prevEffect = activeEffect;
  activeEffect = subscription;

  try {
    return func();
  } finally {
    activeEffect = prevEffect;
    subscription.postTracking();
  }
}
