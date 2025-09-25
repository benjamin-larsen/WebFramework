import { renderQueue } from './render/index.js';
import { INSTANCE_STATES } from './constants.js';
import {
  DependencySubscriber,
  withoutTracking,
  getCurrentInstance,
  setCurrentInstance
} from './effect.js';
import { registerHMRComponent, removeHMRComponent } from './hmr.js';
import { shallowReadonly } from './reactive.js';

const globalSharedProps = new Map();
export const globalProperties = {};

const reservedProps = new Set(['methods', 'data', 'props', 'global']);

const methodsProxyHandler = {
  get(instance, prop) {
    if (!instance.vnode) throw Error('Instance is destroyed.');

    const methods = instance.vnode.component.methods;
    if (
      methods === null ||
      typeof methods !== 'object' ||
      methods.constructor !== Object
    )
      return undefined;

    if (typeof methods[prop] === 'function') {
      return methods[prop].bind(instance.public);
    } else {
      return undefined;
    }
  },

  set() {
    throw Error("Can't override Component Methods.");
  },

  ownKeys(instance) {
    if (!instance.vnode) throw Error('Instance is destroyed.');

    const methods = instance.vnode.component.methods;
    if (
      methods === null ||
      typeof methods !== 'object' ||
      methods.constructor !== Object
    )
      return [];

    return Object.keys(methods);
  },

  deleteProperty() {
    throw Error("Can't delete Component Methods.");
  }
};

const instanceProxyHandler = {
  get(instance, prop) {
    if (!instance.vnode) throw Error('Instance is destroyed.');

    switch (prop) {
      case 'methods': {
        return instance.publicMethods;
      }

      case 'data': {
        return instance.data;
      }

      case 'props': {
        return shallowReadonly(instance.vnode.properties);
      }

      case 'global': {
        return globalProperties;
      }

      case '$set': {
        return ComponentInstance.prototype.setSharedProp.bind(instance);
      }

      case '$unset': {
        return ComponentInstance.prototype.unsetSharedProp.bind(instance);
      }

      case '$get': {
        return ComponentInstance.prototype.getSharedProp.bind(instance);
      }

      case '$list': {
        return ComponentInstance.prototype.listSharedProps.bind(instance);
      }

      case '$forceUpdate': {
        return ComponentInstance.prototype.update.bind(instance);
      }

      case '$raw': {
        return instance;
      }
    }

    if (prop[0] === '$') {
      return globalProperties[prop];
    }

    if (prop in instance.data) {
      return instance.data[prop];
    }

    if (prop in instance.vnode.properties) {
      return instance.vnode.properties[prop];
    }

    return instance.publicMethods[prop];
  },

  set(instance, prop, value) {
    if (!instance.vnode) throw Error('Instance is destroyed.');
    if (reservedProps.has(prop))
      throw Error(`Can't set reserved property ${prop}.`);
    if (prop[0] === '$') throw Error(`Can't set internal functions ${prop}.`);

    instance.data[prop] = value;

    return true;
  },

  ownKeys(instance) {
    if (!instance.vnode) throw Error('Instance is destroyed.');

    return Object.keys(instance.data);
  },

  deleteProperty(instance, prop) {
    if (!instance.vnode) throw Error('Instance is destroyed.');
    if (reservedProps.has(prop))
      throw Error(`Can't delete reserved property ${prop}.`);
    if (prop[0] === '$')
      throw Error(`Can't delete internal functions ${prop}.`);

    delete instance.data[prop];

    return true;
  }
};

export class ComponentInstance {
  constructor(vnode, level, parent) {
    this.vnode = vnode;
    this.level = level;
    this.status = INSTANCE_STATES.BEFORE_MOUNT;

    this.parent = parent;
    this.publicMethods = new Proxy(this, methodsProxyHandler);
    this.public = new Proxy(this, instanceProxyHandler);
    this.data = {};

    this.subscriber = new DependencySubscriber(this.update.bind(this));

    this.callHook('onCreated', shallowReadonly(this.vnode.properties));

    if (import.meta.hot) {
      registerHMRComponent(this);
    }
  }

  setStatus(status) {
    if (
      status === INSTANCE_STATES.UNSYNCED &&
      this.status === INSTANCE_STATES.BEFORE_MOUNT
    )
      return;
    if (status === INSTANCE_STATES.BEFORE_MOUNT) return;

    this.status = status;
  }

  callHook(hookName, ...args) {
    if (!this.vnode) return false;

    const shouldSetInstance = getCurrentInstance() !== this;
    let prevInstance = null;
    if (shouldSetInstance) {
      prevInstance = setCurrentInstance(this);
    }

    try {
      if (typeof this.vnode.component[hookName] === 'function') {
        try {
          withoutTracking(
            this.vnode.component[hookName].bind(this.public, this.public, ...args)
          );
        } catch (e) {
          console.log(
            `Error occured while running Lifecycle Hook: ${hookName}`,
            e
          );
        }

        return true;
      }

      return false;
    } finally {
      if (shouldSetInstance) {
        setCurrentInstance(prevInstance);
      }
    }
  }

  setSharedProp(key, value) {
    const map = this.shared || (this.shared = new Map());
    map.set(key, value);
  }

  unsetSharedProp(key) {
    if (!this.shared) return;
    this.shared.delete(key);
  }

  getSharedProp(key, fallback) {
    for (let currInst = this; currInst; currInst = currInst.parent) {
      if (!currInst.shared) continue;

      if (currInst.shared.has(key)) return currInst.shared.get(key);
    }

    if (globalSharedProps.has(key)) return globalSharedProps.get(key);

    return fallback;
  }

  listSharedProps() {
    const map = new Map();

    for (let currInst = this; currInst; currInst = currInst.parent) {
      if (!currInst.shared) continue;

      for (const [key, value] of currInst.shared) {
        if (map.has(key)) continue;
        map.set(key, value);
      }
    }

    for (const [key, value] of globalSharedProps) {
      if (map.has(key)) continue;
      map.set(key, value);
    }

    return map;
  }

  update() {
    renderQueue.queue(this);
  }

  destroy() {
    if (import.meta.hot) {
      removeHMRComponent(this);
    }

    this.subscriber.destroy();
    this.vnode = null;
  }
}

export function setSharedProp(key, value) {
  const inst = getCurrentInstance();

  if (!inst) {
    globalSharedProps.set(key, value);
    return;
  }

  return inst.setSharedProp(key, value);
}

export function unsetSharedProp(key) {
  const inst = getCurrentInstance();

  if (!inst) {
    globalSharedProps.delete(key);
    return;
  }

  return inst.unsetSharedProp(key);
}

export function getSharedProp(key, fallback) {
  const inst = getCurrentInstance();

  if (!inst) {
    return globalSharedProps.get(key);
  }

  return inst.getSharedProp(key, fallback);
}

export function listSharedProps() {
  const inst = getCurrentInstance();

  if (!inst) {
    return new Map(globalSharedProps);
  }

  return inst.listSharedProps();
}

export function isComponent(comp) {
  if (comp === null || typeof comp !== 'object') return false;
  if (typeof comp.render !== 'function') return false;

  return true;
}
