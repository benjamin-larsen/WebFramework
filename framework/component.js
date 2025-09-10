import { renderQueue } from './render/index.js';
import { FUNCTION_CACHE_LIMIT, INSTANCE_STATES } from './constants.js';
import { DependencySubscriber } from './effect.js';
import { registerHMRComponent, removeHMRComponent } from './hmr.js';

const reservedProps = new Set(['methods', 'data']);

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

      case '$forceUpdate': {
        return instance.update.bind(instance);
      }

      case '$raw': {
        return instance;
      }
    }

    if (prop[0] === '$') {
      return undefined;
    }

    if (prop in instance.data) {
      return instance.data[prop];
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
  constructor(vnode, level) {
    this.vnode = vnode;
    this.level = level;
    this.status = INSTANCE_STATES.BEFORE_MOUNT;

    this.publicMethods = new Proxy(this, methodsProxyHandler);
    this.public = new Proxy(this, instanceProxyHandler);
    this.data = {};

    this.subscriber = new DependencySubscriber(this.update.bind(this));
    this.cachedFunctions = new Map();
    this.cacheHistory = [];

    this.callHook('onCreated', this.vnode.properties);

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
    if (!this.vnode) return;

    if (typeof this.vnode.component[hookName] === 'function') {
      try {
        this.vnode.component[hookName].apply(this.public, args);
      } catch (e) {
        console.log('Error occured while running Lifecycle Hook', e);
      }
    }
  }

  getFn(key, func, force = false) {
    if (!force && this.cachedFunctions.has(key))
      return this.cachedFunctions.get(key);

    // In Future: probably evict based on lowest usage count
    if (this.cacheHistory.length >= FUNCTION_CACHE_LIMIT) {
      const evicted = this.cacheHistory.shift();
      this.cachedFunctions.delete(evicted);
    }

    this.cacheHistory.push(key);
    this.cachedFunctions.set(key, func);
    return func;
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
