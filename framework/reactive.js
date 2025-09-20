import { track, trigger } from './effect.js';
import { REACTIVE_FLAGS } from './constants.js';

const reactiveMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();

const reactiveHandler = {
  get(target, prop) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    track(target);

    const value = Reflect.get(target, prop);

    if (
      value !== null &&
      typeof value === 'object' &&
      !value[REACTIVE_FLAGS.IS_REF]
    ) {
      return reactive(value);
    } else {
      return value;
    }
  },

  set(target, prop, value) {
    const shouldTrigger = target[prop] !== value;

    Reflect.set(target, prop, value);

    if (shouldTrigger) {
      trigger(target);
    }

    return true;
  },

  has(target, prop) {
    const has = Reflect.has(target, prop);

    track(target);

    return has;
  },

  ownKeys(target) {
    track(target);

    return Reflect.ownKeys(target);
  },

  deleteProperty(target, prop) {
    if (prop in target) {
      Reflect.deleteProperty(target, prop);
      trigger(target);
    }

    return true;
  }
};

const shallowReactiveHandler = {
  get(target, prop) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    track(target);

    return Reflect.get(target, prop);
  },

  set: reactiveHandler.set,

  has: reactiveHandler.has,

  ownKeys: reactiveHandler.ownKeys,

  deleteProperty: reactiveHandler.deleteProperty
}

const readonlyHandler = {
  get(target, prop) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    const value = Reflect.get(target, prop);

    if (
      value !== null &&
      typeof value === 'object' &&
      !value[REACTIVE_FLAGS.IS_REF]
    ) {
      return readonly(value);
    } else {
      return value;
    }
  },

  set(target, prop, value) {
    console.warn("Tried to set property", prop, "to", value, "on readonly object", target);
    return true;
  },

  has(target, prop) {
    const has = Reflect.has(target, prop);

    return has;
  },

  ownKeys(target) {
    return Reflect.ownKeys(target);
  },

  deleteProperty(target, prop) {
    console.warn("Tried to delete property", prop, "on readonly object", target);
    return true;
  }
}

const shallowReadonlyHandler = {
  get(target, prop) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    return Reflect.get(target, prop);
  },

  set: readonlyHandler.set,

  has: readonlyHandler.has,

  ownKeys: readonlyHandler.ownKeys,

  deleteProperty: readonlyHandler.deleteProperty
}

function canReact(target) {
  if (target === null || typeof target !== 'object') return false;

  switch (target.constructor) {
    case Object:
    case Array:
    case Map:
    case Set:
    case WeakMap:
    case WeakSet: {
      return true;
    }

    default: {
      return false;
    }
  }
}

export function reactive(target) {
  if (!canReact(target)) return target;
  if (target[REACTIVE_FLAGS.IS_REACTIVE] || target[REACTIVE_FLAGS.IS_READONLY]) return target;
  if (reactiveMap.has(target)) return reactiveMap.get(target);
  const proxy = new Proxy(target, reactiveHandler);

  reactiveMap.set(target, proxy);

  return proxy;
}

export function shallowReactive(target) {
  if (!canReact(target)) return target;
  if (target[REACTIVE_FLAGS.IS_REACTIVE] || target[REACTIVE_FLAGS.IS_READONLY]) return target;
  if (shallowReactiveMap.has(target)) return shallowReactiveMap.get(target);
  const proxy = new Proxy(target, shallowReactiveHandler);

  shallowReactiveMap.set(target, proxy);

  return proxy;
}

export function readonly(target) {
  if (!canReact(target)) return target;
  if (target[REACTIVE_FLAGS.IS_READONLY]) return target;
  
  if (target[REACTIVE_FLAGS.IS_REACTIVE]) {
    target = target[REACTIVE_FLAGS.UNWRAP]
  }

  if (readonlyMap.has(target)) return readonlyMap.get(target);
  const proxy = new Proxy(target, readonlyHandler);

  readonlyMap.set(target, proxy);

  return proxy;
}

export function shallowReadonly(target) {
  if (!canReact(target)) return target;
  if (target[REACTIVE_FLAGS.IS_READONLY]) return target;
  
  if (target[REACTIVE_FLAGS.IS_REACTIVE]) {
    target = target[REACTIVE_FLAGS.UNWRAP]
  }

  if (shallowReadonlyMap.has(target)) return shallowReadonlyMap.get(target);
  const proxy = new Proxy(target, shallowReadonlyHandler);

  shallowReadonlyMap.set(target, proxy);

  return proxy;
}

class ReactiveRef {
  constructor(initValue, isShallow) {
    this[REACTIVE_FLAGS.REF_VALUE] = initValue;
    this[REACTIVE_FLAGS.IS_REF] = true;
    this.isShallow = isShallow;
  }

  get value() {
    track(this);

    const value = this[REACTIVE_FLAGS.REF_VALUE];

    if (
      !this.isShallow &&
      value !== null &&
      typeof value === 'object' &&
      !value[REACTIVE_FLAGS.IS_REF]
    ) {
      return reactive(value);
    } else {
      return value;
    }
  }

  set value(newValue) {
    const shouldTrigger = this[REACTIVE_FLAGS.REF_VALUE] !== newValue;

    this[REACTIVE_FLAGS.REF_VALUE] = newValue;

    if (shouldTrigger) {
      trigger(this);
    }
  }
}

export function isRef(obj) {
  if (obj !== null && typeof obj === 'object' && obj[REACTIVE_FLAGS.IS_REF])
    return true;

  return false;
}

export function ref(initValue) {
  if (
    initValue !== null &&
    typeof initValue === 'object' &&
    initValue[REACTIVE_FLAGS.IS_REF]
  ) {
    return initValue;
  }
  return new ReactiveRef(initValue, false);
}

export function shallowRef(initValue) {
  if (
    initValue !== null &&
    typeof initValue === 'object' &&
    initValue[REACTIVE_FLAGS.IS_REF]
  ) {
    return initValue;
  }
  return new ReactiveRef(initValue, true);
}