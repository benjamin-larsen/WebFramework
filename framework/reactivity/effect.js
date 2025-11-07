import { isRef } from './reactive.js';
import { EFFECT_STATES } from '../constants.js';
import { handleAsyncError } from '../helpers.js';

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
export class Dependency {
    this.subs = new Map();
    this.target = target;
  }

  track() {
    if (!activeEffect) return;

    this.subscribe(activeEffect);
  }

  trigger() {
    for (const sub of this.subs.keys()) {
      sub.trigger();
    }
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

// Incase a destroyed Effect would be used, don't cause a failure.
const mockMap = {
  set() {
    return undefined;
  }
};

export class Effect {
  constructor(func) {
    this.func = func;
    this.deps = new Map();
    this.state = EFFECT_STATES.ENABLED;
  }

  isEnabled() {
    return (this.state & EFFECT_STATES.ENABLED) !== 0;
  }

  pause() {
    this.state |= EFFECT_STATES.PAUSED;
  }

  isPaused() {
    return (this.state & EFFECT_STATES.PAUSED) !== 0;
  }

  isAwaitingEffect() {
    return (this.state & EFFECT_STATES.AWAITING_EFFECT) !== 0;
  }

  resume() {
    if (this.isPaused()) {
      const awaitingRun = this.isAwaitingEffect();

      this.state &= ~(EFFECT_STATES.PAUSED | EFFECT_STATES.AWAITING_EFFECT);

      if (awaitingRun) {
        this.trigger();
      }
    }
  }

  trigger() {
    if (!this.isEnabled()) {
      console.warn('Attempted to trigger a destroyed Effect.');
      return;
    }

    if (this.isPaused()) {
      this.state |= EFFECT_STATES.AWAITING_EFFECT;
    } else if (typeof this.scheduler === 'function') {
      this.scheduler();
    } else {
      this.run();
    }
  }

  run(...args) {
    if (!this.isEnabled()) {
      console.warn('Attempted to run a destroyed Effect.');
      return undefined;
    }

    this.preTracking();

    const prevEffect = activeEffect;
    activeEffect = this;

    try {
      return this.func(...args);
    } finally {
      activeEffect = prevEffect;
      this.postTracking();
    }
  }

  preTracking() {
    this.state |= EFFECT_STATES.RUNNING;

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

    this.state &= ~EFFECT_STATES.RUNNING;
  }

  destroy() {
    for (const dep of this.deps.keys()) {
      dep.unsubscribe(this);
    }

    if (activeEffect === this) {
      activeEffect = null;
    }

    this.func = null;
    this.deps = mockMap;
    this.state = 0;
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

  dep.trigger();
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

const microtaskPromise = Promise.resolve();

function queueJob(job) {
  if (typeof window.queueMicrotask === 'function') return window.queueMicrotask(job);

  microtaskPromise.then(job);
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

  const effect = new Effect(getter);

  function job() {
    if (callback) {
      const newValue = effect.run();

      if (Object.is(newValue, oldValue)) return;

      handleAsyncError(
        () => {
          const prevEffect = activeEffect;
          activeEffect = null;
          try {
            return callback(newValue, oldValue);
          } finally {
            activeEffect = prevEffect;
          }
        },
        null,
        (e, async) => {
          console.log(
            `Error occured while running Watcher.`,
            e,
            { async }
          );
        }
      )

      oldValue = newValue;
    } else {
      effect.run();
    }
  }

  effect.scheduler = () => {
    queueJob(job)
  };

  if (immediate || !callback) {
    job();
  } else {
    oldValue = effect.run();
  }

  instance.watchers.push(effect);

  return () => {
    effect.destroy();

    const index = instance.watchers.indexOf(effect);

    if (index !== -1) {
      instance.watchers.splice(index, 1);
    }
  };
}

export function watchEffect(callback, options = {}) {
  return watch(callback, null, options);
}
