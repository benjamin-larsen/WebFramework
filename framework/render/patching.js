import { renderNode, renderQueue } from './index.js';
import { findAnchor, refreshComponentAnchor } from '../anchor.js';
import { patchProps, patchCompRef } from './patchProps.js';
import {
  ComponentNode,
  ElementNode,
  FragmentNode,
  TextNode
} from '../vnode.js';
import { TeleportNode } from '../Teleport.js';
import { ComponentInstance } from '../component.js';
import { shallowCompareObj, mockMap } from '../helpers.js';
import {
  INSTANCE_STATES,
  NAMESPACES,
  NAMESPACES_TAGS,
  TRANSITION_CLASS
} from '../constants.js';
import { shallowReadonly } from '../reactivity/reactive.js';
import { getCurrentInstance } from '../reactivity/effect.js';
import {
  patchElementDirectives,
  finishElementDirectives
} from './directives.js';

function patchFragment(parentNode, nextArray, prevNode, index, namespace) {
  if (prevNode && prevNode.el) {
    prevNode.el = parentNode.el;
    prevNode.parent = parentNode;
    prevNode.index = index;

    refreshComponentAnchor(prevNode);
    patch(prevNode, nextArray, namespace);
    return prevNode;
  } else {
    const nextNode = new FragmentNode();
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;
    nextNode.index = index;

    refreshComponentAnchor(nextNode);
    patch(nextNode, nextArray, namespace, true);

    return nextNode;
  }
}

function resolveElementTag(tag, namespace) {
  const parts = tag.split(':');

  if (parts.length > 1 && NAMESPACES[parts[0]]) {
    tag = parts.slice(1).join(':');
    namespace = NAMESPACES[parts[0]];
  } else if (NAMESPACES_TAGS[tag]) {
    namespace = NAMESPACES_TAGS[tag];
  } else if (typeof namespace !== 'string') {
    namespace = NAMESPACES.html;
  }

  return { tag, namespace };
}

function patchElement(parentNode, nextNode, prevNode, index, parentNamespace) {
  if (prevNode && prevNode.el && prevNode.tag === nextNode.tag) {
    const nextChildren = nextNode.children;

    // So that patchProps can access .el, will need to reform the way that this is done.
    nextNode.el = prevNode.el;

    patchElementDirectives(prevNode, nextNode);
    patch(prevNode, nextChildren, nextNode.el.namespaceURI);
    patchProps(prevNode, nextNode, nextNode.el.namespaceURI);

    // After done patching props and directivse, set prev properties, invokers and dirs to new, will need to reform this.
    prevNode.properties = nextNode.properties;
    prevNode.eventInvokers = nextNode.eventInvokers;
    prevNode.dirs = nextNode.dirs;

    // <Transition>

    if (prevNode.transition || nextNode.transition) {
      prevNode.transition = nextNode.transition;
    }

    // </Transition>

    finishElementDirectives(prevNode, nextNode);

    if (nextNode.el[TRANSITION_CLASS]) {
      for (const className of nextNode.el[TRANSITION_CLASS]) {
        nextNode.el.classList.add(className);
      }
    }

    return prevNode;
  } else {
    // <Transition>

    let isTransition =
      nextNode.transition && !prevNode
        ? nextNode.transition.startOperation(nextNode)
        : false;

    if (nextNode.transition) {
      nextNode.transition.beforeEnter();
    }

    if (isTransition) {
      nextNode.transition.endOperation();
    }

    // </Transition>

    const { namespace, tag } = resolveElementTag(nextNode.tag, parentNamespace);

    const el = document.createElementNS(namespace, tag);
    nextNode.el = el;

    patchElementDirectives(null, nextNode);
    patch(nextNode, nextNode.children, namespace, true);
    patchProps(null, nextNode, namespace);

    parentNode.el.insertBefore(
      el,
      findAnchor(parentNode.children, index) || parentNode.anchor || null
    );

    finishElementDirectives(null, nextNode);

    if (nextNode.transition) {
      nextNode.transition.onEnter(nextNode.el);
    }

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
    const currentInstance = getCurrentInstance();
    nextNode.instance = new ComponentInstance(
      nextNode,
      currentInstance.level + 1,
      currentInstance
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
    nextNode.keyMap = prevNode.keyMap;
    nextNode.anchor = prevNode.anchor;
    nextNode.index = index;
    nextNode.parent = parentNode;

    patchCompRef(prevNode, nextNode);

    return nextNode;
  } else {
    // Set children as it's used for patching in rendering
    if (prevNode) {
      nextNode.children = prevNode.children;
      nextNode.keyMap = prevNode.keyMap;
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

    // <Transition>

    let isTransition =
      nextNode.transition && !prevNode
        ? nextNode.transition.startOperation(nextNode)
        : false;
    renderNode(nextNode, true);

    if (isTransition) {
      nextNode.transition.endOperation();
    }

    // </Transition>

    patchCompRef(prevNode, nextNode);

    return nextNode;
  }
}

function patchNodeElement(node, el) {
  for (const child of node.children) {
    if (typeof child !== 'object') continue;
    if (!child.el) continue;
    if (
      child.constructor !== FragmentNode &&
      child.constructor !== ComponentNode &&
      child.constructor !== TeleportNode
    )
      continue;

    child.el = el;

    patchNodeElement(child, el);
  }
}

function patchTeleport(parentNode, nextNode, prevNode, index) {
  if (prevNode && prevNode.el) {
    const to = nextNode.properties.to;
    let isDisabled = !!nextNode.properties.disabled;

    let nextEl = parentNode.el;

    if (!isDisabled) {
      let matchedEl;

      if (typeof to === 'object' && to instanceof HTMLElement) {
        matchedEl = to;
      } else if (typeof to === 'string') {
        matchedEl = document.querySelector(to);

        if (!matchedEl)
          console.warn("<Teleport> couldn't find target element.");
      } else {
        console.warn('<Teleport> must be provided with option "to".');
      }

      if (matchedEl) {
        nextEl = matchedEl;
      } else {
        isDisabled = true;
        nextNode.properties = { ...nextNode.properties, disabled: true };
      }
    }

    if (nextEl !== prevNode.el) {
      // namespace may change
      if (nextEl.namespaceURI !== prevNode.el.namespaceURI) {
        // Namespace Altered: Needs remount
        for (const child of prevNode.children) {
          if (!child) continue;
          child.unmount(false, true);
        }

        prevNode.children.length = 0;
      } else {
        prevNode.move(
          nextEl,
          isDisabled
            ? findAnchor(parentNode.children, index) ||
                parentNode.anchor ||
                null
            : null,
          true
        );
      }

      patchNodeElement(prevNode, nextEl);
    }

    prevNode.el = nextEl;

    const nextChildren = nextNode.children;

    prevNode.properties = nextNode.properties;
    prevNode.parent = parentNode;
    prevNode.index = index;

    refreshComponentAnchor(prevNode);
    patch(prevNode, nextChildren, prevNode.el.namespaceURI);

    return prevNode;
  } else {
    const to = nextNode.properties.to;
    let isDisabled = !!nextNode.properties.disabled;
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;
    nextNode.index = index;

    if (!isDisabled) {
      let matchedEl;

      if (typeof to === 'object' && to instanceof HTMLElement) {
        matchedEl = to;
      } else if (typeof to === 'string') {
        matchedEl = document.querySelector(to);

        if (!matchedEl)
          console.warn("<Teleport> couldn't find target element.");
      } else {
        console.warn('<Teleport> must be provided with option "to".');
      }

      if (matchedEl) {
        nextNode.el = matchedEl;
      } else {
        nextNode.properties = { ...nextNode.properties, disabled: true };
      }
    }

    refreshComponentAnchor(nextNode);
    patch(nextNode, nextNode.children, nextNode.el.namespaceURI, true);

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

export function evalDiff(prevNode, nextNode) {
  const prevType = getNodeType(prevNode);
  const nextType = getNodeType(nextNode);

  let isSame = false;
  let prevKey = null;
  let nextKey = null;

  if (
    (prevType === ComponentNode ||
      prevType === ElementNode ||
      prevType === TeleportNode) &&
    prevNode.properties.key !== undefined &&
    prevNode.properties.key !== null
  ) {
    prevKey = prevNode.properties.key;
  }

  if (
    (nextType === ComponentNode ||
      nextType === ElementNode ||
      nextType === TeleportNode) &&
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

  return { isSame, prevKey, nextKey, nextType };
}

function resolveMatchedChild(prevNode, nextNode, nextType) {
  const prevType = getNodeType(prevNode);

  if (
    prevType !== nextType ||
    (prevType === ElementNode && prevNode.tag !== nextNode.tag) ||
    (prevType === ComponentNode && prevNode.component !== nextNode.component)
  ) {
    prevNode.unmount(false, true);

    return null;
  }

  return prevNode;
}

function computeKeys(children) {
  let keyMap = null;

  for (var index = 0; index < children.length; index++) {
    const node = children[index];
    if (node === null || typeof node !== 'object') continue;

    if (
      (node.constructor === ElementNode ||
        node.constructor === ComponentNode ||
        node.constructor === TeleportNode) &&
      node.properties.key !== undefined &&
      node.properties.key !== null
    ) {
      if (keyMap === null) keyMap = new Map();

      if (keyMap.has(node.properties.key))
        throw Error(`Duplicate key: ${node.properties.key}`);
      keyMap.set(node.properties.key, index);
    }
  }

  return keyMap;
}

// Optimize, perhaps by saving some sort of boundary
function assertShouldMove(index, matchedIndex, children) {
  if (index >= matchedIndex) return true; // This shouldn't happen, but just incase.

  for (var i = index + 1; i < matchedIndex; i++) {
    const node = children[i];
    if (node === null) continue;

    return true;
  }

  return false;
}

export function patch(parentNode, nextChildren, namespace, overrideMount) {
  const isMount = overrideMount || parentNode.children.length === 0;

  // Compute Key Map
  const keyMap = !isMount && computeKeys(parentNode.children);

  /*
    Set unmountList to null, to save memory allocation.
    Background: unmountList is a tempoary map to store unmatched previous keyed children.

    If is Mounting, difference won't be evaluated, therefore unmountList is unnescary.
    If previous Key Map is zero, this indicates there are no Keyed Children in previous, therefore unmountList is unnesscary.
  */
  const detachedNodes =
    isMount || !keyMap || keyMap.size === 0 ? mockMap : new Map();

  if (parentNode.children.length < nextChildren.length) {
    parentNode.children.length = nextChildren.length;
  }

  for (var index = 0; index < nextChildren.length; index++) {
    const nextNode = nextChildren[index];
    let prevNode = isMount ? null : parentNode.children[index];

    const diffData = isMount ? null : evalDiff(prevNode, nextNode);

    if (diffData && !diffData.isSame) {
      const sameKey = diffData.prevKey === diffData.nextKey;

      if (diffData.prevKey && !sameKey) {
        // Detach Previous Node
        detachedNodes.set(diffData.prevKey, prevNode);
      } else if (prevNode) {
        prevNode.unmount(false, true);
      }

      // Prev Node was either moved or unmounted. Do not re-use.
      parentNode.children[index] = null;
      prevNode = null;

      if (diffData.nextKey && !sameKey) {
        let matchedNode = detachedNodes.get(diffData.nextKey);
        let shouldMove = false;

        if (matchedNode) {
          // Re-attach Node
          detachedNodes.delete(diffData.nextKey);
          prevNode = resolveMatchedChild(
            matchedNode,
            nextNode,
            diffData.nextType
          );

          shouldMove = true;
        } else if (
          keyMap &&
          typeof (matchedNode = keyMap.get(diffData.nextKey)) === 'number'
        ) {
          prevNode = resolveMatchedChild(
            parentNode.children[matchedNode],
            nextNode,
            diffData.nextType
          );
          parentNode.children[matchedNode] = null;

          shouldMove = assertShouldMove(
            index,
            matchedNode,
            parentNode.children
          );
        }

        if (prevNode && shouldMove) {
          prevNode.move(
            parentNode.el,
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
        namespace
      );
      continue;
    }

    // check if this is VNode rather than just object, copy on mount() as well, and check if any changes made to patch() was not made to mount()
    if (nextNode === null || typeof nextNode !== 'object') {
      if (prevNode) prevNode.unmount(false, true);
      parentNode.children[index] = null;
      continue;
    }

    if (nextNode.constructor === ElementNode) {
      parentNode.children[index] = patchElement(
        parentNode,
        nextNode,
        prevNode,
        index,
        namespace
      );
    } else if (nextNode.constructor === ComponentNode) {
      parentNode.children[index] = patchComponent(
        parentNode,
        nextNode,
        prevNode,
        index
      );
    } else if (nextNode.constructor === TeleportNode) {
      if (nextNode.properties.defer) {
        const nodeIndex = index;

        parentNode.children[nodeIndex] =
          prevNode && prevNode.el ? prevNode : null;

        renderQueue.queuePost(() => {
          parentNode.children[nodeIndex] = patchTeleport(
            parentNode,
            nextNode,
            prevNode,
            nodeIndex
          );
        });
      } else {
        parentNode.children[index] = patchTeleport(
          parentNode,
          nextNode,
          prevNode,
          index
        );
      }
    }
  }

  if (isMount) return;

  // index should inheritely be set to nextChildren.length according to the previous loop
  for (
    index = nextChildren.length;
    index < parentNode.children.length;
    index++
  ) {
    const item = parentNode.children[index];

    if (item) item.unmount(false, true);
  }

  // Clean up Detached Nodes
  for (const [_, orphan] of detachedNodes) {
    orphan.unmount(false, true);
  }

  parentNode.children.length = nextChildren.length;
}
