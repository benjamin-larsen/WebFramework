import { renderNode } from './index.js';
import { findAnchor, refreshComponentAnchor } from '../anchor.js';
import { patchProps } from './patchProps.js';
import {
  ComponentNode,
  ElementNode,
  FragmentNode,
  TextNode
} from '../vnode.js';
import { ComponentInstance } from '../component.js';
import { shallowCompareObj } from '../helpers.js';
import { INSTANCE_STATES } from '../constants.js';

function patchFragment(parentNode, nextArray, prevNode, index, level) {
  if (prevNode && prevNode.el) {
    prevNode.el = parentNode.el;
    prevNode.parent = parentNode;
    prevNode.index = index;

    refreshComponentAnchor(prevNode);
    patch(prevNode, nextArray, level);
    return prevNode;
  } else {
    const nextNode = new FragmentNode();
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;
    nextNode.index = index;

    refreshComponentAnchor(nextNode);
    mount(nextNode, nextArray, level);

    return nextNode;
  }
}

function patchElement(
  parentNode,
  nextNode,
  prevNode,
  index,
  level
) {
  if (prevNode && prevNode.el && prevNode.tag === nextNode.tag) {
    if (prevNode.properties === nextNode.properties) {
      throw Error('Fatal Error: Properties was re-used.');
    }

    const nextChildren = nextNode.children;

    // So that patchProps can access .el, will need to reform the way that this is done.
    nextNode.el = prevNode.el;

    patch(prevNode, nextChildren, level);
    patchProps(prevNode, nextNode);

    // After done patching props, set prev properties to new, will need to reform this.
    prevNode.properties = nextNode.properties;

    return prevNode;
  } else {
    const el = document.createElement(nextNode.tag);
    nextNode.el = el;

    mount(nextNode, nextNode.children, level);
    patchProps(null, nextNode);

    parentNode.el.insertBefore(
      el,
      findAnchor(parentNode.children, index) || parentNode.anchor || null
    );

    return nextNode;
  }
}

function patchText(parentNode, nextText, prevNode, index) {
  if (prevNode && prevNode.el) {
    if (prevNode.text !== nextText) {
      prevNode.el.nodeValue = nextText;
      prevNode.text = nextText;
    }

    return prevNode;
  } else {
    const nextNode = new TextNode(nextText);
    const el = document.createTextNode(nextText);
    nextNode.el = el;

    parentNode.el.insertBefore(
      el,
      findAnchor(parentNode.children, index) || parentNode.anchor || null
    );

    return nextNode;
  }
}

function patchComponent(parentNode, nextNode, prevNode, index, level) {
  if (prevNode && prevNode.instance) {
    nextNode.instance = prevNode.instance;
    nextNode.instance.vnode = nextNode;
  } else {
    nextNode.instance = new ComponentInstance(nextNode, level + 1);
  }

  if (prevNode && prevNode.properties === nextNode.properties) {
    throw Error('Fatal Error: Properties was re-used.');
  }

  if (
    prevNode &&
    prevNode.el &&
    shallowCompareObj(prevNode.properties, nextNode.properties)
  ) {
    nextNode.el = prevNode.el;
    nextNode.children = prevNode.children;
    nextNode.index = index;
    nextNode.parent = parentNode;

    return nextNode;
  } else {
    // Set children as it's used for patching in rendering
    if (prevNode) {
      nextNode.children = prevNode.children;
    }

    nextNode.index = index;
    nextNode.parent = parentNode;
    nextNode.el = parentNode.el;

    nextNode.instance.callHook(
      nextNode.instance.status === INSTANCE_STATES.BEFORE_MOUNT
        ? 'beforeMount'
        : 'beforeUpdate',
      nextNode.properties
    );
    renderNode(nextNode, true);

    return nextNode;
  }
}

function getNodeType(node) {
  if (node === null) return null;
  if (typeof node === 'string') return TextNode;
  if (typeof node !== 'object') return null;
  if (Array.isArray(node)) return FragmentNode;

  return node.constructor;
}

function evalDiff(prevNode, nextNode) {
  const prevType = getNodeType(prevNode);
  const nextType = getNodeType(nextNode);

  let isSame = false;
  let prevKey = null;
  let nextKey = null;

  if (
    (prevType === ComponentNode || prevType === ElementNode) &&
    prevNode.properties.key
  ) {
    prevKey = prevNode.properties.key;
  }

  if (
    (nextType === ComponentNode || nextType === ElementNode) &&
    nextNode.properties.key
  ) {
    nextKey = nextNode.properties.key;
  }

  if (prevType === nextType && prevKey === nextKey) {
    if (prevType === ComponentNode) {
      isSame = prevNode.component === nextNode.component;
    } else if (prevType === ElementNode) {
      isSame = prevNode.tag === nextNode.tag;
    } else {
      isSame = true;
    }
  }

  return { isSame, prevKey, nextKey };
}

function mount(parentNode, nextChildren, level) {
  // Compute Key Map
  const keyMap = new Map();

  for (var index = 0; index < nextChildren.length; index++) {
    const node = nextChildren[index];
    if (node === null || typeof node !== 'object') continue;

    if (
      (node.constructor === ElementNode ||
        node.constructor === ComponentNode) &&
      node.properties.key
    ) {
      if (keyMap.has(node.properties.key))
        throw Error(`Duplicate key: ${node.properties.key}`);
      keyMap.set(node.properties.key, index);
    }
  }

  for (var index = 0; index < nextChildren.length; index++) {
    const nextNode = nextChildren[index];

    if (typeof nextNode === 'string') {
      parentNode.children[index] = patchText(
        parentNode,
        nextNode,
        null,
        index
      );
      continue;
    }

    if (Array.isArray(nextNode)) {
      parentNode.children[index] = patchFragment(
        parentNode,
        nextNode,
        null,
        index,
        level
      );
      continue;
    }

    if (nextNode === null || typeof nextNode !== 'object') {
      parentNode.children[index] = null;
      continue;
    }

    if (nextNode.constructor === ElementNode) {
      parentNode.children[index] = patchElement(
        parentNode,
        nextNode,
        null,
        index,
        level
      );
    } else if (nextNode.constructor === ComponentNode) {
      parentNode.children[index] = patchComponent(
        parentNode,
        nextNode,
        null,
        index,
        level
      );
    }
  }

  parentNode.keyMap = keyMap;
}

export function patch(parentNode, nextChildren, level) {
  if (parentNode.children.length === 0) return mount(parentNode, nextChildren, level);
  // Compute Key Map
  const keyMap = new Map();

  for (var index = 0; index < nextChildren.length; index++) {
    const node = nextChildren[index];
    if (node === null || typeof node !== 'object') continue;

    if (
      (node.constructor === ElementNode ||
        node.constructor === ComponentNode) &&
      node.properties.key
    ) {
      if (keyMap.has(node.properties.key))
        throw Error(`Duplicate key: ${node.properties.key}`);
      keyMap.set(node.properties.key, index);
    }
  }

  for (var index = 0; index < nextChildren.length; index++) {
    const nextNode = nextChildren[index];
    let prevNode = parentNode.children[index];

    const diffData = evalDiff(prevNode, nextNode);

    if (!diffData.isSame) {
      if (diffData.prevKey) {
        const result = keyMap.get(diffData.prevKey);

        if (result !== undefined) {
          if (result > index) {
            parentNode.children[result] = prevNode;
            parentNode.children[index] = null;

            // Check if this is really nesscary
            parentNode.el.insertBefore(
              prevNode.el,
              findAnchor(parentNode.children, result) ||
                parentNode.anchor ||
                null
            );
          }
        } else {
          prevNode.unmount();
          parentNode.children[index] = null;
        }
      } else if (prevNode) {
        prevNode.unmount();
        parentNode.children[index] = null;
      }

      // Prev Node was either moved or unmounted. Do not re-use.
      prevNode = null;

      if (diffData.nextKey) {
        const result = parentNode.keyMap.get(diffData.nextKey);

        if (result !== undefined) {
          if (result < index) {
            // Should logically already be handled
            continue;
          }

          prevNode = parentNode.children[result];
          parentNode.children[result] = null;

          // Check if this is really nesscary
          parentNode.el.insertBefore(
            prevNode.el,
            findAnchor(parentNode.children, index) || parentNode.anchor || null
          );
        }
      }
    }

    if (typeof nextNode === 'string') {
      parentNode.children[index] = patchText(
        parentNode,
        nextNode,
        prevNode,
        index
      );
      continue;
    }

    if (Array.isArray(nextNode)) {
      parentNode.children[index] = patchFragment(
        parentNode,
        nextNode,
        prevNode,
        index,
        level
      );
      continue;
    }

    if (nextNode === null || typeof nextNode !== 'object') {
      if (prevNode) prevNode.unmount();
      parentNode.children[index] = null;
      continue;
    }

    if (nextNode.constructor === ElementNode) {
      parentNode.children[index] = patchElement(
        parentNode,
        nextNode,
        prevNode,
        index,
        level
      );
    } else if (nextNode.constructor === ComponentNode) {
      parentNode.children[index] = patchComponent(
        parentNode,
        nextNode,
        prevNode,
        index,
        level
      );
    }
  }

  parentNode.keyMap = keyMap;

  // index should inheritely be set to nextChildren.length according to the previous loop
  for (index = nextChildren.length; index < parentNode.children.length; index++) {
    const item = parentNode.children[index];

    if (item) item.unmount();
  }

  parentNode.children.length = nextChildren.length;
}
