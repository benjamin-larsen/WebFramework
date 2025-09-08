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

function hotUpdate(hmrId, newComponent) {
    const instanceSet = instanceMap.get(hmrId);
    if (!instanceSet) return;

    for (const instance of instanceSet) {
        if (!instance.vnode) continue;
        instance.vnode.component = newComponent;
        instance.update()
    }
}

if (import.meta.hot) {
    window.HMR = {
        componentMap,
        hotUpdate
    }
}
