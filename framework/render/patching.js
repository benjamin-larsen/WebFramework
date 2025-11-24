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
import { EMPTY_PROPS, NAMESPACES, NAMESPACES_TAGS, TRANSITION_CLASS } from '../constants.js';
import { getCurrentInstance } from '../reactivity/effect.js';
import {
  patchElementDirectives,
  finishElementDirectives
} from './directives.js';

function patchFragment(
  parentNode,
  nextArray,
  prevNode,
  index,
  prevIndex,
  namespace
) {
  if (prevNode && prevNode.el) {
    prevNode.el = parentNode.el;
    prevNode.parent = parentNode;

    prevNode.index = prevIndex;
    refreshComponentAnchor(prevNode);
    patch(prevNode, nextArray, namespace);
    prevNode.index = index;

    return prevNode;
  } else {
    const nextNode = new FragmentNode();
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;

    nextNode.index = prevIndex;
    refreshComponentAnchor(nextNode);
    patch(nextNode, nextArray, namespace, true);
    nextNode.index = index;

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

function patchElement(
  parentNode,
  nextNode,
  prevNode,
  prevIndex,
  parentNamespace
) {
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
      findAnchor(parentNode.children, prevIndex) || parentNode.anchor || null
    );

    finishElementDirectives(null, nextNode);

    if (nextNode.transition) {
      nextNode.transition.onEnter(nextNode.el);
    }

    return nextNode;
  }
}

function patchText(parentNode, nextText, prevNode, prevIndex) {
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
      findAnchor(parentNode.children, prevIndex) || parentNode.anchor || null
    );

    return nextNode;
  }
}

function patchComponent(parentNode, nextNode, prevNode, index, prevIndex) {
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
    shallowCompareObj(prevNode.slots || EMPTY_PROPS, nextNode.slots || EMPTY_PROPS) &&
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

    nextNode.parent = parentNode;
    nextNode.el = parentNode.el;

    // <Transition>

    let isTransition =
      nextNode.transition && !prevNode
        ? nextNode.transition.startOperation(nextNode)
        : false;

    nextNode.index = prevIndex;
    renderNode(nextNode, true);
    nextNode.index = index;

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

function patchTeleport(parentNode, nextNode, prevNode, index, prevIndex) {
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

    prevNode.index = prevIndex;
    refreshComponentAnchor(prevNode);
    patch(prevNode, nextChildren, prevNode.el.namespaceURI);
    prevNode.index = index;

    return prevNode;
  } else {
    const to = nextNode.properties.to;
    let isDisabled = !!nextNode.properties.disabled;
    nextNode.el = parentNode.el;
    nextNode.parent = parentNode;

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

    nextNode.index = prevIndex;
    refreshComponentAnchor(nextNode);
    patch(nextNode, nextNode.children, nextNode.el.namespaceURI, true);
    nextNode.index = index;

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
  const nextKeys = computeKeys(nextChildren);
  const prevKeys = parentNode.keyMap;

  /*
    Set unmountList to null, to save memory allocation.
    Background: unmountList is a tempoary map to store unmatched previous keyed children.

    If is Mounting, difference won't be evaluated, therefore unmountList is unnescary.
    If previous Key Map is zero, this indicates there are no Keyed Children in previous, therefore unmountList is unnesscary.
  */
  const detachedNodes =
    isMount || !prevKeys || prevKeys.size === 0 ? mockMap : new Map();

  let prevIndex = 0;
  let nextIndex = 0;

  while (
    prevIndex < parentNode.children.length ||
    nextIndex < nextChildren.length
  ) {
    const nextNode = nextChildren[nextIndex];
    let prevNode = isMount ? null : parentNode.children[prevIndex];

    const diffData = isMount ? null : evalDiff(prevNode, nextNode);
    let shouldSkipDiff = false;

    const sameKey = !!diffData && diffData.prevKey === diffData.nextKey;

    const hasPrevKey = !!diffData && diffData.prevKey !== null;
    const hasNextKey = !!diffData && diffData.nextKey !== null;

    // Has Previous Node in Next Children?
    const hasPrevNode =
      hasPrevKey &&
      !diffData.isSame &&
      (sameKey ? true : nextKeys && nextKeys.has(diffData.prevKey));

    // Has Next Node in Previous Children?
    const hadNextNode =
      hasNextKey &&
      !diffData.isSame &&
      (sameKey ? true : prevKeys && prevKeys.has(diffData.nextKey));

    if (
      diffData &&
      !diffData.isSame &&
      !sameKey &&
      hasNextKey &&
      // Check if Next Node is new (insert)
      !hadNextNode &&
      // Check that Previous Node still exists (not remove), otherwise would be replace.
      hasPrevNode
    ) {
      prevIndex--;
      shouldSkipDiff = true;
      prevNode = null;
    }

    if (!shouldSkipDiff && diffData && !diffData.isSame) {
      if (hasPrevKey && !sameKey && hasPrevNode) {
        // Detach Previous Node
        detachedNodes.set(diffData.prevKey, prevNode);
      } else if (prevNode) {
        prevNode.unmount(false, true);
        parentNode.children[prevIndex] = null;

        // Check that same conditions (Has Previous Key and not Same Key). To confirm that what is diffrent is that Previous Node doesn't exist anymore (remove).
        // Check if Next Node is not new (not insert), otherwise would be replace.
        if (hasPrevKey && !sameKey && hadNextNode) {
          prevIndex++;
          continue;
        }
      }

      // Prev Node was either moved or unmounted. Do not re-use.
      parentNode.children[prevIndex] = null;
      prevNode = null;

      if (hasNextKey && !sameKey) {
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
          prevKeys &&
          typeof (matchedNode = prevKeys.get(diffData.nextKey)) === 'number'
        ) {
          prevNode = resolveMatchedChild(
            parentNode.children[matchedNode],
            nextNode,
            diffData.nextType
          );
          parentNode.children[matchedNode] = null;

          shouldMove = assertShouldMove(
            prevIndex,
            matchedNode,
            parentNode.children
          );
        }

        if (prevNode && shouldMove) {
          prevNode.move(
            parentNode.el,
            findAnchor(parentNode.children, prevIndex) ||
              parentNode.anchor ||
              null
          );
        }
      }
    }

    if (nextIndex >= nextChildren.length) {
      if (prevNode) prevNode.unmount(false, true);
      prevIndex++;
      continue;
    }

    if (typeof nextNode === 'string') {
      nextChildren[nextIndex] = patchText(
        parentNode,
        nextNode,
        prevNode,
        prevIndex
      );
    } else if (Array.isArray(nextNode)) {
      nextChildren[nextIndex] = patchFragment(
        parentNode,
        nextNode,
        prevNode,
        nextIndex,
        prevIndex,
        namespace
      );
    }
    // check if this is VNode rather than just object, copy on mount() as well, and check if any changes made to patch() was not made to mount()
    else if (nextNode === null || typeof nextNode !== 'object') {
      if (prevNode) prevNode.unmount(false, true);
      nextChildren[nextIndex] = null;
    } else if (nextNode.constructor === ElementNode) {
      nextChildren[nextIndex] = patchElement(
        parentNode,
        nextNode,
        prevNode,
        prevIndex,
        namespace
      );
    } else if (nextNode.constructor === ComponentNode) {
      nextChildren[nextIndex] = patchComponent(
        parentNode,
        nextNode,
        prevNode,
        nextIndex,
        prevIndex
      );
    } else if (nextNode.constructor === TeleportNode) {
      if (nextNode.properties.defer) {
        const nodeIndex = nextIndex;

        nextChildren[nodeIndex] = prevNode && prevNode.el ? prevNode : null;

        renderQueue.queuePost(() => {
          nextChildren[nodeIndex] = patchTeleport(
            parentNode,
            nextNode,
            prevNode,
            nodeIndex,
            nodeIndex
          );
        });
      } else {
        nextChildren[nextIndex] = patchTeleport(
          parentNode,
          nextNode,
          prevNode,
          nextIndex,
          prevIndex
        );
      }
    }

    nextIndex++;
    prevIndex++;
  }

  parentNode.children = nextChildren;
  parentNode.keyMap = nextKeys;
}
