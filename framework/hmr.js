import { INSTANCE_STATES } from "./constants";

const instanceMap = new Map()
const componentMap = new Map()

export function registerHMRComponent(instance) {
    const component = instance.vnode.component;
    const hmrId = component._hmrid;

    if (typeof hmrId !== 'string') return;

    let instanceSet = instanceMap.get(hmrId);

    if (!instanceSet) {
        instanceSet = new Set()
        instanceMap.set(hmrId, instanceSet)
    }

    instanceSet.add(instance)
}

export function removeHMRComponent(instance) {
    const component = instance.vnode.component;
    const hmrId = component._hmrid;

    if (typeof hmrId !== 'string') return;

    const instanceSet = instanceMap.get(hmrId);

    if (!instanceSet) return

    instanceSet.delete(instance)
}

function fullReload(instance, newComponent) {
    // Cleanup old
    instance.callHook("onDestroy")
    instance.data = {}
    instance.status = INSTANCE_STATES.BEFORE_MOUNT

    // Setup new
    instance.vnode.component = newComponent;

    instance.callHook("onCreated", instance.vnode.properties)
    instance.update()
}

function rerender(instance, newComponent) {
    instance.vnode.component = newComponent;
    instance.update()
}

function shouldFullReload(instance, newComponent) {
    const hasPrev = typeof instance.vnode.component.onCreated === 'function'
    const hasNext = typeof newComponent.onCreated === 'function'

    console.log({ hasNext, hasPrev })

    if (hasPrev && !hasNext) return true;
    if (!hasPrev && hasNext) return true;
    if (!hasPrev && !hasNext) return false;

    if (instance.vnode.component.onCreated.toString() !== newComponent.onCreated.toString()) return true;

    return false;
}

function hotUpdate(hmrId, newComponent) {
    const instanceSet = instanceMap.get(hmrId);
    if (!instanceSet) return;

    for (const instance of instanceSet) {
        if (!instance.vnode) continue;

        if (shouldFullReload(instance, newComponent)) {
            fullReload(instance, newComponent)
        } else {
            rerender(instance, newComponent)
        }
    }
}

if (import.meta.hot) {
    window.HMR = {
        componentMap,
        hotUpdate
    }
}
