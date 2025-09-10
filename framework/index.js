import { renderQueue } from './render/index.js';
export {
  root,
  head,
  body,
  e,
  t,
  c,
  v,
  createElement,
  createTextNode,
  createComponent,
  createVNode
} from './vnode.js';
export { reactive, ref } from './reactive.js';

import {
  RootContainer,
  ElementNode,
  ComponentNode,
  TextNode
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
