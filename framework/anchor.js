import { ComponentNode, FragmentNode } from './vnode.js';
import { TeleportNode } from './Teleport.js';

export function findAnchor(oldRender, index) {
  for (var i = index + 1; i < oldRender.length; i++) {
    const item = oldRender[i];
    if (!item) continue;

    if (item.constructor === TeleportNode) {
      // Ignore enabled Teleports, as they have their own DOM structure.
      if (!item.properties.disabled) continue;

      const anchor = findAnchor(item.children, -1);
      if (anchor) return anchor;
    }
    if (
      item.constructor === ComponentNode ||
      item.constructor === FragmentNode
    ) {
      const anchor = findAnchor(item.children, -1);
      if (anchor) return anchor;
    } else if (item.el) {
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
        component.constructor !== FragmentNode &&
        component.constructor !== TeleportNode)
    )
      return null;

    // Ignore enabled Teleports, as the Teleport would be the anchor.
    if (
      component.constructor === TeleportNode &&
      !component.properties.disabled
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
  // Ignore enabled Teleports, as the Teleport would be the anchor.
  if (
    component.constructor === TeleportNode &&
    !component.properties.disabled
  ) {
    component.anchor = null;
    return;
  }

  const anchor = findAnchor(component.parent.children, component.index);

  if (anchor) {
    component.anchor = anchor;
  } else {
    component.anchor = findComponentAnchor(component.parent);
  }
}
