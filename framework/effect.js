import { isRef } from './reactive.js';

const targetMap = new Map();
let activeEffect = null;

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

function subscribe(target, subscriber) {
  let dep = targetMap.get(target);

  if (!dep) {
    dep = new Dependency(target);
    targetMap.set(target, dep);
  }

  dep.subscribe(subscriber);
}

export function track(target) {
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

export function withTracking(subscription, func) {
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

export function withoutTracking(func) {
  const prevEffect = activeEffect;
  activeEffect = null;

  try {
    return func();
  } finally {
    activeEffect = prevEffect;
  }
}

export function watch(dep, callback, options = {}) {
  if (!currentInstance)
    throw Error('Attempted to call watch() outside Instance');

  const instance = currentInstance;

  const { immediate = false } = options;

  let getter = () => undefined;

  if (!callback && typeof dep !== 'function')
    throw Error('Watch Effect must be provided a Function.');

  if (isRef(dep)) {
    getter = () => dep.value;
  } else if (typeof dep === 'function') {
    getter = dep;
  }

  let oldValue = undefined;

  function onReact() {
    if (callback) {
      const newValue = getter();

      if (newValue === oldValue) return;

      withoutTracking(callback.bind(null, newValue, oldValue));

      oldValue = newValue;
    } else {
      getter();
    }
  }

  const sub = new DependencySubscriber(onReact);
  getter = withTracking.bind(null, sub, getter);

  if (immediate || !callback) {
    onReact();
  } else {
    oldValue = getter();
  }

  instance.watchers.push(sub);

  return () => {
    sub.destroy();

    const index = instance.watchers.indexOf(sub);

    if (index !== -1) {
      instance.watchers.splice(index, 1);
    }
  };
}

export function watchEffect(callback, options = {}) {
  return watch(callback, null, options);
}
