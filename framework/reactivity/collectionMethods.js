import { toRaw, readonly, reactive } from './reactive.js';
import { track, trigger } from './effect.js';
import { REACTIVE_FLAGS, ITERATE_KEY, TRIGGER_TYPES } from '../constants.js';

function toReadonly(obj) {
  if (obj !== null && typeof obj === 'object' && !obj[REACTIVE_FLAGS.IS_REF]) {
    return readonly(obj);
  } else {
    return obj;
  }
}

function toReactive(obj) {
  if (obj !== null && typeof obj === 'object' && !obj[REACTIVE_FLAGS.IS_REF]) {
    return reactive(obj);
  } else {
    return obj;
  }
}

function iterator(isReadonly, isShallow, method) {
  return function () {
    const rawTarget = toRaw(this);
    const isMap = Object.prototype.toString.call(rawTarget) === '[object Map]';

    const rawIterator = rawTarget[method]();
    const isPair =
      method === 'entries' || (isMap && method === Symbol.iterator);
    const wrap = isShallow ? (v) => v : isReadonly ? toReadonly : toReactive;

    if (!isReadonly) {
      track(rawTarget, ITERATE_KEY);
    }

    return {
      next() {
        const { value, done } = rawIterator.next();

        if (!done) {
          return {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done: false
          };
        }

        return { value, done };
      },

      [Symbol.iterator]() {
        return this;
      }
    };
  };
}

function setRelationalMethod(method, isReadonly) {
  return function (other) {
    const rawTarget = toRaw(this);
    const rawOther = toRaw(other);

    // Run method before tracking, incase of error.
    const result = rawTarget[method](rawOther);

    if (!isReadonly) {
      track(rawTarget, ITERATE_KEY);

      if (other !== rawOther) {
        track(rawOther, ITERATE_KEY);
      }
    }

    return result;
  };
}

function createCollectionMethods(isReadonly, isShallow) {
  return {
    get(key) {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, key);
      }

      let rawKey;
      let value;

      const hasKey = rawTarget.has(key);

      if (hasKey) {
        value = rawTarget.get(key);
      } else if (key !== (rawKey = toRaw(key))) {
        value = rawTarget.get(rawKey);
        if (!isReadonly) {
          track(rawTarget, rawKey);
        }
      }

      if (
        !isShallow &&
        value !== null &&
        typeof value === 'object' &&
        !value[REACTIVE_FLAGS.IS_REF]
      ) {
        return isReadonly ? readonly(value) : reactive(value);
      } else {
        return value;
      }
    },

    has(key) {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, key);
      }

      let result = rawTarget.has(key);
      let rawKey;

      if (!result && key !== (rawKey = toRaw(key))) {
        result = rawTarget.has(rawKey);
        if (!isReadonly) {
          track(rawTarget, rawKey);
        }
      }

      return result;
    },

    add(key) {
      if (isReadonly) {
        console.warn('Tried to add', key, 'on readonly Collection', this);
        return this;
      }

      const rawTarget = toRaw(this);
      const rawKey = toRaw(key);

      const shouldAdd = !rawTarget.has(rawKey);

      if (shouldAdd) {
        rawTarget.add(rawKey);

        trigger(rawTarget, TRIGGER_TYPES.ADD, rawKey, rawKey);
      }

      return this;
    },

    set(key, value) {
      if (isReadonly) {
        console.warn(
          'Tried to set',
          key,
          'to',
          value,
          'on readonly Collection',
          this
        );
        return this;
      }

      const rawTarget = toRaw(this);
      let rawKey;

      let hadKey = rawTarget.has(key);
      if (!hadKey && (rawKey = toRaw(key)) !== key) {
        key = rawKey;
        hadKey = rawTarget.has(rawKey);
      }

      const shouldTrigger =
        !hadKey || (!isReadonly && !Object.is(rawTarget.get(key), value));

      rawTarget.set(key, value);

      if (shouldTrigger) {
        trigger(
          rawTarget,
          hadKey ? TRIGGER_TYPES.SET : TRIGGER_TYPES.ADD,
          key,
          value
        );
      }

      return this;
    },

    delete(key) {
      if (isReadonly) {
        console.warn('Tried to delete', key, 'on readonly Collection', this);
        return false;
      }

      const rawTarget = toRaw(this);
      let rawKey;

      let hadKey = rawTarget.has(key);
      if (!hadKey && (rawKey = toRaw(key)) !== key) {
        key = rawKey;
        hadKey = rawTarget.has(rawKey);
      }

      const hasDeleted = hadKey ? rawTarget.delete(key) : false;

      if (hasDeleted) {
        trigger(rawTarget, TRIGGER_TYPES.DELETE, key, undefined);
      }

      return hasDeleted;
    },

    clear() {
      if (isReadonly) {
        console.warn('Tried to clear readonly Collection', this);
        return;
      }

      const rawTarget = toRaw(this);

      const shouldTrigger = rawTarget.size !== 0;

      rawTarget.clear();

      if (shouldTrigger) {
        trigger(rawTarget, TRIGGER_TYPES.CLEAR, undefined, undefined);
      }
    },

    forEach(callback, thisArg) {
      const target = this;
      const rawTarget = toRaw(target);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      const wrap = isShallow ? (v) => v : isReadonly ? toReadonly : toReactive;

      rawTarget.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), target);
      });
    },

    get size() {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, 'size');
      }

      return rawTarget.size;
    },

    difference: setRelationalMethod('difference', isReadonly),
    intersection: setRelationalMethod('intersection', isReadonly),
    isDisjointFrom: setRelationalMethod('isDisjointFrom', isReadonly),
    isSubsetOf: setRelationalMethod('isSubsetOf', isReadonly),
    isSupersetOf: setRelationalMethod('isSupersetOf', isReadonly),
    symmetricDifference: setRelationalMethod('symmetricDifference', isReadonly),
    union: setRelationalMethod('union', isReadonly),

    [Symbol.iterator]: iterator(isReadonly, isShallow, Symbol.iterator),
    keys: iterator(isReadonly, isShallow, 'keys'),
    values: iterator(isReadonly, isShallow, 'values'),
    entries: iterator(isReadonly, isShallow, 'entries')
  };
}

const reactiveCollectionMethods = createCollectionMethods(false, false);
const shallowReactiveCollectionMethods = createCollectionMethods(false, true);
const readonlyCollectionMethods = createCollectionMethods(true, false);
const shallowReadonlyCollectionMethods = createCollectionMethods(true, true);

export const reactiveCollectionHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    const hasMethod = prop in reactiveCollectionMethods && prop in target;

    return Reflect.get(
      hasMethod ? reactiveCollectionMethods : target,
      prop,
      receiver
    );
  }
};

export const shallowReactiveCollectionHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_REACTIVE) {
      return true;
    }

    const hasMethod =
      prop in shallowReactiveCollectionMethods && prop in target;

    return Reflect.get(
      hasMethod ? shallowReactiveCollectionMethods : target,
      prop,
      receiver
    );
  }
};

export const readonlyCollectionHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    const hasMethod = prop in readonlyCollectionMethods && prop in target;

    return Reflect.get(
      hasMethod ? readonlyCollectionMethods : target,
      prop,
      receiver
    );
  }
};

export const shallowReadonlyCollectionHandler = {
  get(target, prop, receiver) {
    if (prop === REACTIVE_FLAGS.UNWRAP) return target;
    if (prop === REACTIVE_FLAGS.IS_READONLY) {
      return true;
    }

    const hasMethod =
      prop in shallowReadonlyCollectionMethods && prop in target;

    return Reflect.get(
      hasMethod ? shallowReadonlyCollectionMethods : target,
      prop,
      receiver
    );
  }
};
