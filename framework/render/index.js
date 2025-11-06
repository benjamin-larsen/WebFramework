import { ComponentNode } from '../vnode.js';
import { refreshComponentAnchor } from '../anchor.js';
import { patch } from './patching.js';
import { INSTANCE_STATES, EMPTY_PROPS } from '../constants.js';
import {
  withTracking,
  setCurrentRoot,
  setCurrentInstance
} from '../reactivity/effect.js';
import { shallowReadonly } from '../reactivity/reactive.js';

let shouldTrackTime = false;

export function enableRenderTiming() {
  shouldTrackTime = true;
}

class RenderQueue {
  constructor() {
    this.waiting = new Set();
    this.waitingDir = new Set();
    this.renderId = null;

    this.currentPromise = null;
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

      setCurrentRoot(componentInstance);
      renderNode(componentInstance.vnode);
    }

    setCurrentRoot(null);

    for (const dir of dirs) {
      if (!dir.sub) continue;

      dir.runReact(false);
    }

    if (promise) {
      promise.resolve();
    }

    if (this.waiting.size > 0 || this.waitingDir.size > 0) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    } else {
      this.renderId = null;
    }
  }

  queueDirective(dir) {
    this.setPromise();

    dir.status = INSTANCE_STATES.UNSYNCED;

    this.waitingDir.add(dir);

    if (!this.renderId) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    }
  }

  queue(component) {
    this.setPromise();

    component.setStatus(INSTANCE_STATES.UNSYNCED);

    this.waiting.add(component);

    if (!this.renderId) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    }
  }
}

export const renderQueue = new RenderQueue();

const furfilledPromise = Promise.resolve();

export function nextTick() {
  if (!renderQueue.currentPromise) return furfilledPromise;

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

    const nextChildren = withTracking(
      node.instance.subscriber,
      node.component.render.bind(
        node.instance.public,
        node.instance.public,
        shallowReadonly(node.properties),
        node.slots || EMPTY_PROPS
      )
    );

    if (!Array.isArray(nextChildren)) {
      throw Error('Render function must return a Fragment.');
    }

    patch(node, nextChildren, node.el.namespaceURI);

    const isMounted = node.instance.status === INSTANCE_STATES.BEFORE_MOUNT;
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
