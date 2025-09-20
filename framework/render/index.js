import { ComponentNode } from '../vnode.js';
import { refreshComponentAnchor } from '../anchor.js';
import { patch } from './patching.js';
import { INSTANCE_STATES, EMPTY_PROPS } from '../constants.js';
import {
  withTracking,
  setCurrentRoot,
  setCurrentInstance,
  popCurrentInstance
} from '../effect.js';
import { shallowReadonly } from '../reactive.js';

let shouldTrackTime = false;

export function enableRenderTiming() {
  shouldTrackTime = true;
}

class RenderQueue {
  constructor() {
    this.waiting = new Set();
    this.renderId = null;
  }

  process() {
    const items = [...this.waiting]
      .filter((inst) => inst.vnode)
      .sort((a, b) => a.level - b.level);
    this.waiting.clear();

    for (const componentInstance of items) {
      if (!componentInstance.vnode) continue;

      setCurrentRoot(componentInstance);
      renderNode(componentInstance.vnode);
    }

    if (this.waiting.size > 0) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    } else {
      setCurrentRoot(null);
      this.renderId = null;
    }
  }

  queue(component) {
    component.setStatus(INSTANCE_STATES.UNSYNCED);

    this.waiting.add(component);

    if (!this.renderId) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    }
  }
}

export const renderQueue = new RenderQueue();

export function renderNode(node, force) {
  if (!node.instance) return;
  if (!force && node.instance.status === INSTANCE_STATES.SYNCED) return;

  let startTime = shouldTrackTime ? performance.now() : 0;

  try {
    setCurrentInstance(node.instance);

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

    patch(node, nextChildren, node.instance.level);

    const isMounted = node.instance.status === INSTANCE_STATES.BEFORE_MOUNT;

    node.instance.setStatus(INSTANCE_STATES.SYNCED);
    node.instance.callHook(
      isMounted ? 'onMounted' : 'onUpdated',
      shallowReadonly(node.properties)
    );
  } finally {
    popCurrentInstance();

    if (shouldTrackTime) {
      const time = performance.now() - startTime;
      node.lastTime = time;
    }
  }
}
