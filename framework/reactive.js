import { effectStack, depManager } from "./render/index.js"; 

const reactiveHandler = {
    get(target, prop, receiver) {
        const currentEffect = effectStack.getActiveEffect();

        if (currentEffect) {
            currentEffect("get", {target, prop, receiver})
        }

        const value = target[prop];

        if (false && value !== null && typeof value === 'object') {
            return reactive(value)
        } else {
            return value
        }

        return target[prop];
    },
    set(target, prop, value, receiver) {
        const shouldTrigger = target[prop] !== value;

        target[prop] = value;

        if (shouldTrigger) {
            depManager.trigger(target)
        }

        return true;
    },
    ownKeys(target) {
        const currentEffect = effectStack.getActiveEffect();

        if (currentEffect) {
            currentEffect("get", { target })
        }

        return Object.keys(target)
    },
    deleteProperty(target, prop) {
        if (prop in target) {
            delete target[prop]
            depManager.trigger(target)
        }

        return true
    }
}

export function reactive(target) {
    return new Proxy(target, reactiveHandler);
}