import { ComponentNode, FragmentNode } from './vnode.js';

export function findAnchor(oldRender, index) {
  for (var i = index + 1; i < oldRender.length; i++) {
    const item = oldRender[i];
    if (!item) continue;

    if (
      item.constructor === ComponentNode ||
      item.constructor === FragmentNode
    ) {
      const anchor = findAnchor(item.children, -1);
      if (anchor) return anchor;
    } else {
      return item.el;
    }
  }

  return null;
}

// Make better and more efficent system later, perhaps using two-phase rendering
function findComponentAnchor(initComponent) {
  let component = initComponent;

  while (true) {
    if (
    !component ||
    (component.constructor !== ComponentNode &&
      component.constructor !== FragmentNode)
  )
    return null;

    const anchor = findAnchor(component.parent.children, component.index);

    if (anchor) {
      return anchor;
    } else {
      component = component.parent;
    }
  }
}

export function refreshComponentAnchor(component) {
  const anchor = findAnchor(component.parent.children, component.index);

  if (anchor) {
    component.anchor = anchor;
  } else {
    component.anchor = findComponentAnchor(component.parent);
  }
}
