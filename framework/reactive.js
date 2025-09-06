import { track, trigger } from "./effect.js";
import { REACTIVE_FLAGS } from "./constants.js";

const reactiveMap = new WeakMap()

const reactiveHandler = {
    get(target, prop, receiver) {
        if (prop === REACTIVE_FLAGS) {
            return true;
        }

        track(target)

        const value = target[prop];

        if (value !== null && typeof value === 'object' && !value[REACTIVE_FLAGS.IS_REF]) {
            return reactive(value)
        } else {
            return value
        }
    },
    set(target, prop, value) {
        const shouldTrigger = target[prop] !== value;

        target[prop] = value;

        if (shouldTrigger) {
            trigger(target)
        }

        return true;
    },
    ownKeys(target) {
        track(target)

        return Object.keys(target)
    },
    deleteProperty(target, prop) {
        if (prop in target) {
            delete target[prop]
            trigger(target)
        }

        return true
    }
}

export function reactive(target) {
    if (target[REACTIVE_FLAGS]) return target;
    if (reactiveMap.has(target)) return reactiveMap.get(target);
    const proxy = new Proxy(target, reactiveHandler);

    reactiveMap.set(target, proxy)

    return proxy;
}

class ReactiveRef {
    constructor(initValue) {
        this[REACTIVE_FLAGS.REF_VALUE] = initValue;
        this[REACTIVE_FLAGS.IS_REF] = true;
    }

    get value() {
        track(this)

        const value = this[REACTIVE_FLAGS.REF_VALUE];

        if (value !== null && typeof value === 'object' && !value[REACTIVE_FLAGS.IS_REF]) {
            return reactive(value)
        } else {
            return value
        }
    }

    set value(newValue) {
        const shouldTrigger = this[REACTIVE_FLAGS.REF_VALUE] !== newValue;

        this[REACTIVE_FLAGS.REF_VALUE] = newValue;

        if (shouldTrigger) {
            trigger(this)
        }
    }
}

export function ref(initValue) {
    if (initValue !== null && typeof initValue === 'object' && initValue[REACTIVE_FLAGS.IS_REF]) {
        return initValue;
    }
    return new ReactiveRef(initValue)
}