import { INSTANCE_STATES } from './constants.js';
import { shallowReadonly } from './reactivity/reactive.js';

const instanceMap = new Map();
const componentMap = new Map();

export function registerHMRComponent(instance) {
  const component = instance.vnode.component;
  const hmrId = component._hmrid;

  if (typeof hmrId !== 'string') return;

  let instanceSet = instanceMap.get(hmrId);

  if (!instanceSet) {
    instanceSet = new Set();
    instanceMap.set(hmrId, instanceSet);
  }

  instanceSet.add(instance);
}

export function removeHMRComponent(instance) {
  const component = instance.vnode.component;
  const hmrId = component._hmrid;

  if (typeof hmrId !== 'string') return;

  const instanceSet = instanceMap.get(hmrId);

  if (!instanceSet) return;

  instanceSet.delete(instance);
}

const SYNCED_KEY = Symbol('hmr_synced');

export function syncComponentDef(oldDef, def) {
  if (oldDef === def) return;
  if (oldDef[SYNCED_KEY] === def) return;

  Object.assign(oldDef, def);

  for (const key in oldDef) {
    if (key === SYNCED_KEY) continue;
    if (key === '_hmrid') continue;
    if (key === '_onlyRender') continue;
    if (key in def) continue;

    delete oldDef[key];
  }

  oldDef[SYNCED_KEY] = def;
}

function fullReload(instance, newComponent) {
  // Cleanup old
  instance.callHook('onDestroy');
  instance.data = {};
  instance.functionCache = [];

  for (const watcher of instance.watchers) {
    watcher.destroy();
  }

  instance.watchers = [];

  instance.status = INSTANCE_STATES.BEFORE_MOUNT;

  // Setup new
  syncComponentDef(instance.vnode.component, newComponent);

  instance.callHook('onCreated', shallowReadonly(instance.vnode.properties));
  instance.update();
}

function rerender(instance, newComponent) {
  instance.functionCache = [];
  syncComponentDef(instance.vnode.component, newComponent);
  instance.update();
}

function hotUpdate(hmrId, newComponent) {
  const instanceSet = instanceMap.get(hmrId);
  if (!instanceSet) return;

  for (const instance of instanceSet) {
    if (!instance.vnode) continue;

    if (newComponent._onlyRender) {
      rerender(instance, newComponent);
    } else {
      fullReload(instance, newComponent);
    }
  }
}

if (import.meta.hot) {
  window.HMR = { componentMap, hotUpdate };
}
