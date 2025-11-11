import { REACTIVE_FLAGS } from '../constants.js';
import { Dependency } from './effect.js';
import { reactive } from './reactive.js';

class ReactiveRef {
  constructor(initValue, isShallow) {
    this[REACTIVE_FLAGS.REF_VALUE] = initValue;
    this.isShallow = isShallow;
    this.dep = new Dependency(null, null);
  }

  get [REACTIVE_FLAGS.IS_REF]() {
    return true;
  }

  get [Symbol.toStringTag]() {
    return 'Ref';
  }

  get value() {
    this.dep.track();

    const value = this[REACTIVE_FLAGS.REF_VALUE];

    if (
      !this.isShallow &&
      value !== null &&
      typeof value === 'object' &&
      !value[REACTIVE_FLAGS.IS_REF] &&
      !value[REACTIVE_FLAGS.IS_READONLY]
    ) {
      return reactive(value);
    } else {
      return value;
    }
  }

  set value(newValue) {
    const shouldTrigger = !Object.is(this[REACTIVE_FLAGS.REF_VALUE], newValue);

    this[REACTIVE_FLAGS.REF_VALUE] = newValue;

    if (shouldTrigger) {
      this.dep.trigger();
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

export function triggerRef(obj) {
  if (!isRef(obj)) return;
  if (!obj.dep) return;

  obj.dep.trigger();
}
