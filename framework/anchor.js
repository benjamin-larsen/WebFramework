import { ComponentNode } from "./vnode.js";

export function findAnchor(oldRender, index) {
    for (var i = (index + 1); i < oldRender.length; i++) {
        const item = oldRender[i]
        if (!item) continue;

        if (item instanceof ComponentNode) {
            const anchor = findAnchor(item.children, -1);
            if (anchor) return anchor
        } else {
            return item.node
        }
    }

    return null;
}

// Make better and more efficent system later, perhaps using two-phase rendering
function findComponentAnchor(component) {
    if (!(component instanceof ComponentNode)) return null;
    const anchor = findAnchor(component.parent.children, component.index)

    if (anchor) {
        return anchor;
    } else {
        return findComponentAnchor(component.parent)
    }
}

export function refreshComponentAnchor(component) {
    const anchor = findAnchor(component.parent.children, component.index);

    if (anchor) {
        component.anchor = anchor
    } else {
       component.anchor = findComponentAnchor(component.parent)
    }
}