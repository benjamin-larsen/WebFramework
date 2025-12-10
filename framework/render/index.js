import { ComponentNode } from '../vnode.js';
import { refreshComponentAnchor } from '../anchor.js';
import { patch } from './patching.js';
import { INSTANCE_STATES } from '../constants.js';
import {
  getCurrentInstance,
  setCurrentInstance,
  queueJob
} from '../reactivity/effect.js';
import { shallowReadonly } from '../reactivity/reactive.js';
import { setNodeTransition } from '../standardComponents/Transition.js';

let shouldTrackTime = false;

export function enableRenderTiming() {
  shouldTrackTime = true;
}

let queueFn = requestAnimationFrame;

export function setInstantRender(value) {
  queueFn = value ? queueJob : requestAnimationFrame;
}

class RenderQueue {
  constructor() {
    this.waiting = new Set();
    this.waitingDir = new Set();
    this.renderId = null;

    this.isRunning = false;

    this.currentPromise = null;
    this.postJobs = [];
  }

  setPromise() {
    if (this.currentPromise) return;

    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.currentPromise = { promise, resolve, reject };
  }

  process() {
    this.isRunning = true;

    const items = [...this.waiting]
      .filter((inst) => inst.vnode)
      .sort((a, b) => a.level - b.level);
    const dirs = [...this.waitingDir];
    this.waiting.clear();
    this.waitingDir.clear();

    const promise = this.currentPromise;
    this.currentPromise = null;

    for (const componentInstance of items) {
      if (!componentInstance.vnode) continue;

      renderNode(componentInstance.vnode);
    }

    for (const dir of dirs) {
      if (!dir.effect) continue;

      dir.effect.run();
    }

    while (this.postJobs.length > 0) {
      const postJobs = [...this.postJobs];
      this.postJobs.length = 0;

      for (const job of postJobs) {
        try {
          job();
        } catch (e) {
          console.log('Error occured while running Post-Render Job.', e);
        }
      }
    }

    if (promise) {
      promise.resolve();
    }

    this.isRunning = false;

    if (this.waiting.size > 0 || this.waitingDir.size > 0) {
      this.renderId = queueFn(this.process.bind(this));
    } else {
      this.renderId = null;
    }
  }

  queuePost(job) {
    if (!this.isRunning) {
      console.warn('queuePost() was called outside of Render Queue.');
      return;
    }

    const currentInstance = getCurrentInstance();

    this.postJobs.push(() => {
      const prevInstance = setCurrentInstance(currentInstance);

      try {
        job();
      } catch (e) {
        setCurrentInstance(prevInstance);
        throw e;
      }
    });
  }

  queueDirective(dir) {
    this.setPromise();

    dir.status = INSTANCE_STATES.UNSYNCED;

    this.waitingDir.add(dir);

    if (!this.renderId) {
      this.renderId = queueFn(this.process.bind(this));
    }
  }

  queue(component) {
    this.setPromise();

    component.setStatus(INSTANCE_STATES.UNSYNCED);

    this.waiting.add(component);

    if (!this.renderId) {
      this.renderId = queueFn(this.process.bind(this));
    }
  }
}

export const renderQueue = new RenderQueue();

let currentTickSeeker = null;

export function nextTick() {
  if (!renderQueue.currentPromise) {
    if (currentTickSeeker) return currentTickSeeker;

    currentTickSeeker = new Promise((resolve) => {
      queueJob(() => {
        if (renderQueue.currentPromise) {
          renderQueue.currentPromise.promise.then(() => {
            currentTickSeeker = null;
            resolve();
          });
          return;
        };

        currentTickSeeker = null;

        resolve();
      })
    })

    return currentTickSeeker;
  }

  return renderQueue.currentPromise.promise;
}

export function renderNode(node, force) {
  if (!node.instance) return;
  if (!force && node.instance.status === INSTANCE_STATES.SYNCED) return;

  const startTime = shouldTrackTime ? performance.now() : 0;
  const prevInstance = setCurrentInstance(node.instance);

  try {
    if (node.constructor === ComponentNode) {
      refreshComponentAnchor(node);
    }

    let isMounted = node.instance.status === INSTANCE_STATES.BEFORE_MOUNT;
    node.instance.callHook(
      isMounted ? 'beforeMount' : 'beforeUpdate',
      shallowReadonly(node.properties)
    );

    const nextChildren = node.instance.effect.run();

    if (!Array.isArray(nextChildren)) {
      throw Error('Render function must return a Fragment.');
    }

    if (node.transition) {
      setNodeTransition(nextChildren, node.transition);
    }

    patch(node, nextChildren, node.el.namespaceURI);

    node.instance.setStatus(INSTANCE_STATES.SYNCED);

    node.instance.callHook(
      isMounted ? 'onMounted' : 'onUpdated',
      shallowReadonly(node.properties)
    );
  } catch (e) {
    const success = node.instance.callHook('onError', e);

    if (!success) {
      console.log(
        'Uncaught Error occured while attempting to Render Component.',
        e
      );
    }
  } finally {
    setCurrentInstance(prevInstance);

    if (shouldTrackTime) {
      const time = performance.now() - startTime;
      node.lastTime = time;
    }
  }
}
