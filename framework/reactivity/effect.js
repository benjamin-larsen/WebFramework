import { isRef } from './ref.js';
import { toRaw } from './reactive.js';
import { EFFECT_STATES, ITERATE_KEY, TRIGGER_TYPES } from '../constants.js';
import { handleAsyncError, isIntegerKey, mockMap } from '../helpers.js';

const targetMap = new Map();
let activeEffect = null;

let trackHook = null;
let triggerHook = null;

export function setReactivityHooks(onTrack, onTrigger) {
  trackHook = typeof onTrack === 'function' ? onTrack : null;
  triggerHook = typeof onTrigger === 'function' ? onTrigger : null;
}

export function setActiveEffect(value) {
  const prevEffect = activeEffect;
  activeEffect = value;

  return prevEffect;
}

let currentInstance = null;

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

let triggerQueue = new Set();
let triggerQueued = false;

function scheduleTrigger(effect) {
  triggerQueue.add(effect);

  if (!triggerQueued) {
    triggerQueued = true;

    queueJob(() => {
      const effects = [...triggerQueue];
      triggerQueue.clear();
      triggerQueued = false;

      for (const effect of effects) {
        try {
          effect.trigger();
        } catch (e) {
          console.log(
            'Error occured while attempting to run Effect.',
            effect,
            e
          );
        }
      }
    });
  }
}

export class Dependency {
  constructor(target, key) {
    this.subs = new Map();
    this.target = target;
    this.key = key;
  }

  track() {
    if (!activeEffect) return;

    this.subscribe(activeEffect);
  }

  trigger() {
    for (const sub of this.subs.keys()) {
      scheduleTrigger(sub);
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

    const depsMap = targetMap.get(this.target);
    if (!depsMap) return;

    if (this.subs.size === 0) {
      depsMap.delete(this.key);
    }

    if (depsMap.size === 0) {
      targetMap.delete(this.target);
    }
  }
}

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
  if (typeof window.queueMicrotask === 'function')
    return window.queueMicrotask(job);

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

function subscribe(target, key, subscriber) {
  let propsMap = targetMap.get(target);

  if (!propsMap) {
    propsMap = new Map();
    targetMap.set(target, propsMap);
  }

  let dep = propsMap.get(key);

  if (!dep) {
    dep = new Dependency(target, key);
    propsMap.set(key, dep);
  }

  dep.subscribe(subscriber);
}

export function track(target, key) {
  if (trackHook) trackHook(target, key);

  if (!activeEffect) return;

  subscribe(target, key, activeEffect);
}

export function trigger(target, triggerType, key, newValue, oldValue) {
  if (triggerHook) triggerHook(target, triggerType, key, newValue, oldValue);

  const propsMap = targetMap.get(target);
  if (!propsMap) return;

  function sub(dep) {
    if (dep) {
      for (const effect of dep.subs.keys()) {
        scheduleTrigger(effect);
      }
    }
  }

  if (triggerType === TRIGGER_TYPES.CLEAR) {
    propsMap.forEach(sub);
  } else if (triggerType === TRIGGER_TYPES.UPDATE_ARRAY) {
    sub(propsMap.get(ITERATE_KEY));

    const hasStart = typeof newValue === 'number';
    const hasEnd = typeof oldValue === 'number';

    for (const [key, dep] of propsMap) {
      if (!isIntegerKey(key)) continue;
      const parsedInt = parseInt(key);

      if (hasStart && parsedInt < newValue) continue;
      if (hasEnd && parsedInt >= newValue) continue;

      sub(dep);
    }
  } else {
    const type = Object.prototype.toString.call(target);
    const isArray = type === '[object Array]';
    const isCollection =
      type === '[object Map]' ||
      type === '[object Set]' ||
      type === '[object WeakMap]' ||
      type === '[object WeakSet]';

    sub(propsMap.get(ITERATE_KEY));
    sub(propsMap.get(key));

    if (isArray && key === 'length') {
      const newLength = Number(newValue) || 0;
      const oldLength = Number(oldValue) || 0;

      /*
        Update indexes that would've been removed from the length changes.
        No need to update indexes that would've been added from length changes, as it will be undefined anyway.
      */

      if (newLength < oldLength) {
        for (const [key, dep] of propsMap) {
          if (!isIntegerKey(key)) continue;

          const index = parseInt(key, 10);
          if (index < newLength) continue;

          sub(dep);
        }
      }
    }

    switch (triggerType) {
      case TRIGGER_TYPES.ADD: {
        if (isArray && isIntegerKey(key)) {
          sub(propsMap.get('length'));
        } else if (isCollection) {
          sub(propsMap.get('size'));
        }
        break;
      }
    }
  }
}

export function forceTrigger(target) {
  const propsMap = targetMap.get(toRaw(target));
  if (!propsMap) return;

  for (const dep of propsMap.values()) {
    for (const effect of dep.subs.keys()) {
      scheduleTrigger(effect);
    }
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
