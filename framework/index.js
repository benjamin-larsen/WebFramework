import { renderQueue } from './render/index.js';
export { nextTick, setInstantRender } from './render/index.js';
export {
  root,
  head,
  body,
  e,
  c,
  v,
  createElement,
  createComponent,
  createVNode,
  withDirectives
} from './vnode.js';
export {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw
} from './reactivity/reactive.js';
export { ref, shallowRef, isRef, triggerRef } from './reactivity/ref.js';
export {
  withoutTracking,
  watch,
  watchEffect,
  watchAsyncEffect,
  Effect,
  AsyncEffect,
  awaitEffect,
  forceTrigger
} from './reactivity/effect.js';
export { default as Debugger } from './debug/index.js';
export { usePlugin } from './plugins.js';
export { default as nModel } from './standardDirectives/nModel.js';
export {
  setSharedProp,
  unsetSharedProp,
  getSharedProp,
  listSharedProps,
  isComponent,
  globalProperties,
  withContext
} from './component.js';

import {
  RootContainer,
  ElementNode,
  ComponentNode,
  TextNode,
  FragmentNode
} from './vnode.js';
import { TeleportNode } from './Teleport.js';
export { createTeleport } from './Teleport.js';

function printVNode(node, indent = '') {
  if (node instanceof RootContainer) {
    console.log(`${indent}<Root`, node.el, '>');
  } else if (node instanceof ElementNode) {
    console.log(`${indent}<${node.tag}>`);
  } else if (node instanceof TeleportNode) {
    console.log(`${indent}<Teleport>`);
  } else if (node instanceof ComponentNode) {
    console.log(`${indent}<Component`, node.component, '>');
  } else if (node instanceof TextNode) {
    console.log(`${indent}#text ${JSON.stringify(node.text)}`);
  } else if (node instanceof FragmentNode) {
    console.log(`${indent}<Fragment>`);
  } else {
    console.log(`${indent}<empty slot>`);
  }

  if (node && node.children) {
    for (const child of node.children) {
      printVNode(child, indent + '  ');
    }
  }

  if (node instanceof RootContainer) {
    console.log(`${indent}</Root>`);
  } else if (node instanceof ElementNode) {
    console.log(`${indent}</${node.tag}>`);
  } else if (node instanceof TeleportNode) {
    console.log(`${indent}</Teleport>`);
  } else if (node instanceof FragmentNode) {
    console.log(`${indent}</Fragment>`);
  } else if (node instanceof ComponentNode) {
    console.log(`${indent}</Component>`);
  }
}

export class App {
  constructor(...children) {
    this.children = children;
  }

  render() {
    for (const child of this.children) {
      renderQueue.queue(child.instance);
    }
  }

  print() {
    console.log('<App>');
    for (const child of this.children) {
      printVNode(child, '  ');
    }
    console.log('</App>');
  }
}
