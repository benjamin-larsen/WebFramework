import { renderQueue } from './render/index.js';
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
  ref,
  shallowRef,
  isRef
} from './reactive.js';
export { withoutTracking } from './effect.js';
export { default as Debugger } from './debug/index.js';
export { usePlugin } from './plugins.js';

import {
  RootContainer,
  ElementNode,
  ComponentNode,
  TextNode,
  FragmentNode
} from './vnode.js';

function printVNode(node, indent = '') {
  if (node instanceof RootContainer) {
    console.log(`${indent}<Root`, node.el, '>');
  } else if (node instanceof ElementNode) {
    console.log(`${indent}<${node.tag}>`);
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
