import { ComponentNode } from '../vnode.js';
import { refreshComponentAnchor } from '../anchor.js';
import { patch } from './patching.js';
import { INSTANCE_STATES } from '../constants.js';
import { withTracking } from '../effect.js';

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

      renderNode(componentInstance.vnode);
    }

    if (this.waiting.size > 0) {
      this.renderId = requestAnimationFrame(this.process.bind(this));
    } else {
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

  if (node.constructor === ComponentNode) {
    refreshComponentAnchor(node);
  }

  const prevChildren = node.children;

  const nextChildren = withTracking(
    node.instance.subscriber,
    node.component.render.bind(node.instance.public, node.properties)
  );


  patch(node, prevChildren, nextChildren, node.instance.level);

  node.instance.setStatus(INSTANCE_STATES.SYNCED);
  node.instance.callHook(
    node.instance.status === INSTANCE_STATES.BEFORE_MOUNT
      ? 'onMounted'
      : 'onUpdated',
    node.properties || {}
  );
}
