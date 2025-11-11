import { toRaw, readonly, reactive } from './reactive.js';
import { track, trigger, setActiveEffect } from './effect.js';
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

function iterator(isReadonly, wrap, method) {
  return function () {
    const rawTarget = toRaw(this);

    const rawIterator = rawTarget[method]();
    const isPair = method === 'entries';
    const shouldWrap = method === 'values' || method === Symbol.iterator;

    if (!isReadonly) {
      track(rawTarget, method === 'keys' ? 'length' : ITERATE_KEY);
    }

    return {
      next() {
        const { value, done } = rawIterator.next();

        if (!done) {
          return {
            value: isPair
              ? [value[0], wrap(value[1])]
              : shouldWrap
                ? wrap(value)
                : value,
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

function readArray(target) {
  const rawTarget = toRaw(target);

  if (target !== rawTarget) {
    track(rawTarget, ITERATE_KEY);
  }

  return rawTarget;
}

function createNoTracking(method) {
  return function (...args) {
    const prevEffect = setActiveEffect(null);

    try {
      return toRaw(this)[method].call(this, ...args);
    } finally {
      setActiveEffect(prevEffect);
    }
  };
}

function createArrayMethods(isReadonly, isShallow) {
  const wrap = isShallow ? (v) => v : isReadonly ? toReadonly : toReactive;

  function createCallbackMethod(method, shouldWrap) {
    return function (callback, thisArg) {
      const target = this;
      const rawTarget = toRaw(target);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      const result = rawTarget[method]((element, index) => {
        return callback.call(thisArg, wrap(element), index, target);
      });

      return shouldWrap ? wrap(result) : result;
    };
  }

  return {
    concat(...arrays) {
      return readArray(this).concat(...arrays.map(readArray));
    },

    every: createCallbackMethod('every', false),
    filter: createCallbackMethod('filter', false),
    find: createCallbackMethod('find', true),
    findIndex: createCallbackMethod('findIndex', false),
    findLast: createCallbackMethod('findLast', true),
    findLastIndex: createCallbackMethod('findLastIndex', false),
    forEach: createCallbackMethod('forEach', false),
    map: createCallbackMethod('map', false),
    some: createCallbackMethod('some', false),

    includes(searchElement, fromIndex) {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      let result = rawTarget.includes(searchElement, fromIndex);

      let rawElement;
      if (!result && (rawElement = toRaw(searchElement)) !== searchElement) {
        result = rawTarget.includes(rawElement, fromIndex);
      }

      return result;
    },

    indexOf(searchElement, fromIndex) {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      let result = rawTarget.indexOf(searchElement, fromIndex);

      let rawElement;
      if (
        result === -1 &&
        (rawElement = toRaw(searchElement)) !== searchElement
      ) {
        result = rawTarget.indexOf(rawElement, fromIndex);
      }

      return result;
    },

    join(separator) {
      return readArray(this).join(separator);
    },

    lastIndexOf(searchElement, fromIndex) {
      const rawTarget = toRaw(this);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      let result = rawTarget.lastIndexOf(searchElement, fromIndex);

      let rawElement;
      if (
        result === -1 &&
        (rawElement = toRaw(searchElement)) !== searchElement
      ) {
        result = rawTarget.lastIndexOf(rawElement, fromIndex);
      }

      return result;
    },

    reduce(callback, initialValue) {
      const target = this;
      const rawTarget = toRaw(target);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      const result = rawTarget.reduce(function (
        accumulator,
        currentValue,
        currentIndex
      ) {
        return callback(
          wrap(accumulator),
          wrap(currentValue),
          currentIndex,
          target
        );
      }, initialValue);

      return wrap(result);
    },

    reduceRight(callback, initialValue) {
      const target = this;
      const rawTarget = toRaw(target);

      if (!isReadonly) {
        track(rawTarget, ITERATE_KEY);
      }

      const result = rawTarget.reduceRight(function (
        accumulator,
        currentValue,
        currentIndex
      ) {
        return callback(
          wrap(accumulator),
          wrap(currentValue),
          currentIndex,
          target
        );
      }, initialValue);

      return wrap(result);
    },

    reverse() {
      if (isReadonly) {
        console.warn('Tried to reverse readonly Array', this);
        return this;
      }

      const rawTarget = toRaw(this);
      rawTarget.reverse();

      trigger(rawTarget, TRIGGER_TYPES.UPDATE_ARRAY, undefined, undefined);

      return this;
    },

    sort(compareFn) {
      if (isReadonly) {
        console.warn('Tried to sort readonly Array', this);
        return this;
      }

      const rawTarget = toRaw(this);
      rawTarget.sort(
        typeof compareFn === 'function'
          ? function (a, b) {
              return compareFn(wrap(a), wrap(b));
            }
          : compareFn
      );

      trigger(rawTarget, TRIGGER_TYPES.UPDATE_ARRAY, undefined, undefined);

      return this;
    },

    toReversed() {
      return readArray(this).toReversed();
    },

    toSorted(compareFn) {
      return readArray(this).toSorted(compareFn);
    },

    toSpliced(start, skipCount, ...items) {
      return readArray(this).toSpliced(start, skipCount, ...items);
    },

    with(index, value) {
      return readArray(this).with(index, value);
    },

    push: createNoTracking('push'),
    pop: createNoTracking('pop'),
    shift: createNoTracking('shift'),
    unshift: createNoTracking('unshift'),
    splice: createNoTracking('splice'),

    entries: iterator(isReadonly, wrap, 'entries'),
    keys: iterator(isReadonly, wrap, 'keys'),
    values: iterator(isReadonly, wrap, 'values'),
    [Symbol.iterator]: iterator(isReadonly, wrap, Symbol.iterator)
  };
}

export const reactiveArrayMethods = createArrayMethods(false, false);
export const shallowReactiveArrayMethods = createArrayMethods(false, true);
export const readonlyArrayMethods = createArrayMethods(true, false);
export const shallowReadonlyArrayMethods = createArrayMethods(true, true);
