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
import { shallowReadonly } from '../reactive.js';
import { getCurrentInstance } from '../effect.js';

function patchFragment(parentNode, nextArray, prevNode, index) {
  if (prevNode && prevNode.el) {
    prevNode.el = parentNode.el;
    prevNode.parent = parentNode;
    prevNode.index = index;

    refreshComponentAnchor(prevNode);
    patch(prevNode, nextArray);
    return prevNode;
  } else {
    const nextNode = new FragmentNode();
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;
    nextNode.index = index;

    refreshComponentAnchor(nextNode);
    mount(nextNode, nextArray);

    return nextNode;
  }
}

function patchElement(parentNode, nextNode, prevNode, index) {
  if (prevNode && prevNode.el && prevNode.tag === nextNode.tag) {
    const nextChildren = nextNode.children;

    // So that patchProps can access .el, will need to reform the way that this is done.
    nextNode.el = prevNode.el;

    patch(prevNode, nextChildren);
    patchProps(prevNode, nextNode);

    // After done patching props, set prev properties to new, will need to reform this.
    prevNode.properties = nextNode.properties;

    return prevNode;
  } else {
    const el = document.createElement(nextNode.tag);
    nextNode.el = el;

    mount(nextNode, nextNode.children);
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

function patchComponent(parentNode, nextNode, prevNode, index) {
  if (prevNode && prevNode.instance) {
    nextNode.instance = prevNode.instance;
    nextNode.instance.vnode = nextNode;
  } else {
    nextNode.instance = new ComponentInstance(
      nextNode,
      getCurrentInstance().level + 1
    );
  }

  if (
    prevNode &&
    prevNode.el &&
    !prevNode.slots && // Force render if previous has slots, may have been changed or removed
    !nextNode.slots && // Force render if next has slots, has been added
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

    if (nextNode.instance.status !== INSTANCE_STATES.BEFORE_MOUNT) {
      nextNode.instance.callHook(
        'beforeUpdate',
        shallowReadonly(nextNode.properties)
      );
    }

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
    prevNode.properties.key !== undefined &&
    prevNode.properties.key !== null
  ) {
    prevKey = prevNode.properties.key;
  }

  if (
    (nextType === ComponentNode || nextType === ElementNode) &&
    nextNode.properties.key !== undefined &&
    nextNode.properties.key !== null
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

function mount(parentNode, nextChildren) {
  // Compute Key Map
  const keyMap = new Map();

  for (var index = 0; index < nextChildren.length; index++) {
    const node = nextChildren[index];
    if (node === null || typeof node !== 'object') continue;

    if (
      (node.constructor === ElementNode ||
        node.constructor === ComponentNode) &&
      node.properties.key !== undefined &&
      node.properties.key !== null
    ) {
      if (keyMap.has(node.properties.key))
        throw Error(`Duplicate key: ${node.properties.key}`);
      keyMap.set(node.properties.key, index);
    }
  }

  for (var index = 0; index < nextChildren.length; index++) {
    const nextNode = nextChildren[index];

    if (typeof nextNode === 'string') {
      parentNode.children[index] = patchText(parentNode, nextNode, null, index);
      continue;
    }

    if (Array.isArray(nextNode)) {
      parentNode.children[index] = patchFragment(
        parentNode,
        nextNode,
        null,
        index
      );
      continue;
    }

    // check if this is VNode rather than just object, copy on mount() as well, and check if any changes made to patch() was not made to mount()
    if (nextNode === null || typeof nextNode !== 'object') {
      parentNode.children[index] = null;
      continue;
    }

    if (nextNode.constructor === ElementNode) {
      parentNode.children[index] = patchElement(
        parentNode,
        nextNode,
        null,
        index
      );
    } else if (nextNode.constructor === ComponentNode) {
      parentNode.children[index] = patchComponent(
        parentNode,
        nextNode,
        null,
        index
      );
    }
  }

  parentNode.keyMap = keyMap;
}

export function patch(parentNode, nextChildren) {
  if (parentNode.children.length === 0) return mount(parentNode, nextChildren);
  // Compute Key Map
  const keyMap = new Map();
  const unmountList = new Map();

  for (var index = 0; index < nextChildren.length; index++) {
    const node = nextChildren[index];
    if (node === null || typeof node !== 'object') continue;

    if (
      (node.constructor === ElementNode ||
        node.constructor === ComponentNode) &&
      node.properties.key !== undefined &&
      node.properties.key !== null
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
        // Stash Previous Node
        unmountList.set(diffData.prevKey, prevNode);
      } else if (prevNode) {
        prevNode.unmount();
      }

      // Prev Node was either moved or unmounted. Do not re-use.
      parentNode.children[index] = null;
      prevNode = null;

      if (diffData.nextKey) {
        const result =
          unmountList.get(diffData.nextKey) ||
          parentNode.keyMap.get(diffData.nextKey);

        // for currentNode to be keyed, it must mean that it was not stashed previously
        if (typeof result === 'number') {
          prevNode = parentNode.children[result];
          parentNode.children[result] = null;

          // Check if this is really nesscary
          prevNode.move(
            parentNode,
            findAnchor(parentNode.children, index) || parentNode.anchor || null
          );
        } else if (typeof result === 'object') {
          unmountList.delete(diffData.nextKey);
          prevNode = result;

          prevNode.move(
            parentNode,
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
        index
      );
      continue;
    }

    // check if this is VNode rather than just object, copy on mount() as well, and check if any changes made to patch() was not made to mount()
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
        index
      );
    } else if (nextNode.constructor === ComponentNode) {
      parentNode.children[index] = patchComponent(
        parentNode,
        nextNode,
        prevNode,
        index
      );
    }
  }

  parentNode.keyMap = keyMap;

  // index should inheritely be set to nextChildren.length according to the previous loop
  for (
    index = nextChildren.length;
    index < parentNode.children.length;
    index++
  ) {
    const item = parentNode.children[index];

    if (item) item.unmount();
  }

  for (const [_, orphan] of unmountList) {
    orphan.unmount();
  }

  parentNode.children.length = nextChildren.length;
}
