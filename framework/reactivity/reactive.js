import { REACTIVE_FLAGS, ITERATE_KEY, TRIGGER_TYPES } from '../constants.js';
import { track, trigger } from './effect.js';
import {
  reactiveCollectionHandler,
  shallowReactiveCollectionHandler,
  readonlyCollectionHandler,
  shallowReadonlyCollectionHandler
} from './collectionMethods.js';
import {
  reactiveArrayMethods,
  shallowReactiveArrayMethods,
  readonlyArrayMethods,
  shallowReadonlyArrayMethods
} from './arrayMethods.js';

const reactiveMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();
const markedRawMap = new WeakSet();

function hasOwnProperty(key) {
  const keyType = typeof key;

  if (keyType !== 'string' && keyType !== 'symbol') {
    key = String(key);
  }

  const rawTarget = toRaw(this);
  track(rawTarget, key);

  return rawTarget.hasOwnProperty(key);
}

const reactiveHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    if (prop === 'hasOwnProperty') return hasOwnProperty;

    let arrMethod;
    if (
      Array.isArray(target) &&
      prop in target &&
      (arrMethod = reactiveArrayMethods[prop])
    ) {
      return arrMethod;
    }

    track(target, prop);

    const value = Reflect.get(target, prop, receiver);

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

  set(target, prop, value, receiver) {
    const hadValue = prop in target;
    const oldValue = hadValue ? target[prop] : undefined;
    const shouldTrigger = !hadValue || !Object.is(oldValue, value);

    const success = Reflect.set(target, prop, value, receiver);

    if (success && shouldTrigger) {
      trigger(
        target,
        hadValue ? TRIGGER_TYPES.SET : TRIGGER_TYPES.ADD,
        prop,
        value,
        oldValue
      );
    }

    return success;
  },

  has(target, prop) {
    const has = Reflect.has(target, prop);

    track(target, prop);

    return has;
  },

  ownKeys(target) {
    track(target, ITERATE_KEY);

    return Reflect.ownKeys(target);
  },

  deleteProperty(target, prop) {
    const shouldTrigger = prop in target;

    const success = Reflect.deleteProperty(target, prop);

    if (success && shouldTrigger) {
      trigger(target, TRIGGER_TYPES.DELETE, prop, undefined);
    }

    return success;
  }
};

const shallowReactiveHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    if (prop === 'hasOwnProperty') return hasOwnProperty;

    let arrMethod;
    if (
      Array.isArray(target) &&
      prop in target &&
      (arrMethod = shallowReactiveArrayMethods[prop])
    ) {
      return arrMethod;
    }

    track(target, prop);

    return Reflect.get(target, prop, receiver);
  },

  set: reactiveHandler.set,

  has: reactiveHandler.has,

  ownKeys: reactiveHandler.ownKeys,

  deleteProperty: reactiveHandler.deleteProperty
};

const readonlyHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    let arrMethod;
    if (
      Array.isArray(target) &&
      prop in target &&
      (arrMethod = readonlyArrayMethods[prop])
    ) {
      return arrMethod;
    }

    const value = Reflect.get(target, prop, receiver);

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
    console.warn(
      'Tried to set property',
      prop,
      'to',
      value,
      'on readonly object',
      target
    );

    return false;
  },

  has(target, prop) {
    const has = Reflect.has(target, prop);

    return has;
  },

  ownKeys(target) {
    return Reflect.ownKeys(target);
  },

  deleteProperty(target, prop) {
    console.warn(
      'Tried to delete property',
      prop,
      'on readonly object',
      target
    );

    return false;
  }
};

const shallowReadonlyHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    let arrMethod;
    if (
      Array.isArray(target) &&
      prop in target &&
      (arrMethod = shallowReadonlyArrayMethods[prop])
    ) {
      return arrMethod;
    }

    return Reflect.get(target, prop, receiver);
  },

  set: readonlyHandler.set,

  has: readonlyHandler.has,

  ownKeys: readonlyHandler.ownKeys,

  deleteProperty: readonlyHandler.deleteProperty
};

function getTargetType(target) {
  if (markedRawMap.has(target)) return null;

  const type = Object.prototype.toString.call(target).slice(8, -1);

  switch (type) {
    case 'Object':
    case 'Array': {
      return 'standard';
    }

    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet': {
      return 'collection';
    }

    default: {
      return null;
    }
  }
}

export function reactive(target) {
  if (target === null || typeof target !== 'object') return target;
  if (target[REACTIVE_FLAGS.IS_REACTIVE] || target[REACTIVE_FLAGS.IS_READONLY])
    return target;

  const existing = reactiveMap.get(target);
  if (existing) return existing;

  const targetType = getTargetType(target);
  if (targetType === null) return target;

  const proxy = new Proxy(
    target,
    targetType === 'standard' ? reactiveHandler : reactiveCollectionHandler
  );

  reactiveMap.set(target, proxy);

  return proxy;
}

export function shallowReactive(target) {
  if (target === null || typeof target !== 'object') return target;
  if (target[REACTIVE_FLAGS.IS_REACTIVE] || target[REACTIVE_FLAGS.IS_READONLY])
    return target;

  const existing = shallowReactiveMap.get(target);
  if (existing) return existing;

  const targetType = getTargetType(target);
  if (targetType === null) return target;

  const proxy = new Proxy(
    target,
    targetType === 'standard'
      ? shallowReactiveHandler
      : shallowReactiveCollectionHandler
  );

  shallowReactiveMap.set(target, proxy);

  return proxy;
}

export function readonly(target) {
  if (target === null || typeof target !== 'object') return target;
  if (target[REACTIVE_FLAGS.IS_READONLY]) return target;

  if (target[REACTIVE_FLAGS.IS_REACTIVE]) {
    target = target[REACTIVE_FLAGS.UNWRAP];
  }

  const existing = readonlyMap.get(target);
  if (existing) return existing;

  const targetType = getTargetType(target);
  if (targetType === null) return target;

  const proxy = new Proxy(
    target,
    targetType === 'standard' ? readonlyHandler : readonlyCollectionHandler
  );

  readonlyMap.set(target, proxy);

  return proxy;
}

export function shallowReadonly(target) {
  if (target === null || typeof target !== 'object') return target;
  if (target[REACTIVE_FLAGS.IS_READONLY]) return target;

  if (target[REACTIVE_FLAGS.IS_REACTIVE]) {
    target = target[REACTIVE_FLAGS.UNWRAP];
  }

  const existing = shallowReadonlyMap.get(target);
  if (existing) return existing;

  const targetType = getTargetType(target);
  if (targetType === null) return target;

  const proxy = new Proxy(
    target,
    targetType === 'standard'
      ? shallowReadonlyHandler
      : shallowReadonlyCollectionHandler
  );

  shallowReadonlyMap.set(target, proxy);

  return proxy;
}

export function markRaw(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (getTargetType(obj) === null) return obj;

  markedRawMap.add(obj);

  return obj;
}

export function toRaw(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  return obj[REACTIVE_FLAGS.UNWRAP] || obj;
}
