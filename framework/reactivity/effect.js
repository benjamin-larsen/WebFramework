import { isRef } from './ref.js';
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

export class Dependency {
  constructor(target) {
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

    for (const subscription of this.deps.values()) {
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

const microtaskPromise = Promise.resolve();

function queueJob(job) {
  if (typeof window.queueMicrotask === 'function') return window.queueMicrotask(job);

  microtaskPromise.then(job);
}

export function awaitEffect(promise) {
  const effect = activeEffect;

  if (!effect) {
    console.warn('awaitEffect: called outside of Effect.');
    return promise;
  }

  if (!effect.async) {
    console.warn(
      'awaitEffect: async not available, Effect is either done running, or Effect is not Async.'
    );
    return promise;
  }

  const asyncStatus = effect.async;

  const generateWrapper = (func) => {
    return function (value) {
      if (asyncStatus.aborted) return;
      if (asyncStatus.finished) return func(value);

      let prevEffect;

      try {
        // Queue Microtask to set Active Effect
        // We do this because we assume that func() is a function queues a Microtask (like await).
        queueJob(() => {
          prevEffect = activeEffect;
          activeEffect = effect;
        });

        func(value);
      } finally {
        // Queue Microtask to restore Previous Effect
        // We do this because we assume that func() queued a previous microtask, so that it runs immediately after running the next.
        queueJob(() => {
          activeEffect = prevEffect;
        });
      }
    };
  };

  return {
    then(onFulfilled, onRejected) {
      const wrappedFulfilled =
        typeof onFulfilled === 'function'
          ? generateWrapper(onFulfilled)
          : onFulfilled;

      const wrappedRejected =
        typeof onRejected === 'function'
          ? generateWrapper(onRejected)
          : onRejected;

      return promise.then(wrappedFulfilled, wrappedRejected);
    }
  };
}

export class AsyncEffect extends Effect {
  constructor(func) {
    super(func);

    this.state |= EFFECT_STATES.ASYNC_EFFECT;
    this.async = null;
  }

  run(...args) {
    if (!this.isEnabled()) {
      console.warn('Attempted to run a destroyed Effect.');
      return undefined;
    }

    if (this.async) {
      this.async.aborted = true;
    }

    const asyncStatus = { aborted: false, finished: false };

    this.async = asyncStatus;

    this.preTracking();

    const prevEffect = activeEffect;
    activeEffect = this;

    try {
      try {
        const result = this.func(...args);

        if (
          result !== null &&
          typeof result === 'object' &&
          typeof result.then === 'function'
        ) {
          const postTracking = AsyncEffect.prototype.postTracking.bind(
            this,
            asyncStatus
          );

          result.then(postTracking, postTracking);
        } else {
          this.postTracking();
        }

        return result;
      } catch {
        this.postTracking();
      }
    } finally {
      activeEffect = prevEffect;
    }
  }

  postTracking(asyncStatus) {
    asyncStatus.finished = true;
    this.async = null;

    super.postTracking();
  }

  destroy() {
    if (this.async) {
      this.async.aborted = true;
      this.async = null;
    }

    super.destroy();
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

export function watch(dep, callback, options = {}) {
  if (!currentInstance)
    throw Error('Attempted to call watch() outside Instance');

  const instance = currentInstance;

  const { immediate = false, async = false } = options;

  let getter = () => undefined;

  if (!callback && typeof dep !== 'function')
    throw Error('Watch Effect must be provided a Function.');

  let hasMultipleDeps = false;

  if (isRef(dep)) {
    getter = () => dep.value;
  } else if (Array.isArray(dep)) {
    hasMultipleDeps = true;

    getter = () =>
      dep.map((subDep) => {
        if (isRef(subDep)) {
          return subDep.value;
        } else if (typeof subDep === 'function') {
          return subDep();
        }
      });
  } else if (typeof dep === 'function') {
    getter = dep;
  }

  let oldValue = hasMultipleDeps
    ? new Array(dep.length).fill(undefined)
    : undefined;

  const effect =
    async && !callback ? new AsyncEffect(getter) : new Effect(getter);

  function job() {
    if (callback) {
      const newValue = effect.run();

      if (
        hasMultipleDeps
          ? !newValue.some((val, i) => !Object.is(val, oldValue[i]))
          : Object.is(newValue, oldValue)
      )
        return;

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
          console.log(`Error occured while running Watcher.`, e, { async });
        }
      );

      oldValue = newValue;
    } else {
      effect.run();
    }
  }

  effect.scheduler = () => {
    queueJob(job);
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

export function watchAsyncEffect(callback, options = {}) {
  return watch(callback, null, { async: true, ...options });
}
