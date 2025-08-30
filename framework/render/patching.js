import { renderNode } from "./index.js";
import { findAnchor } from "../anchor.js";
import { patchProps } from "./patchProps.js";
import { ComponentNode, ElementNode, TextNode } from "../vnode.js";
import { ComponentInstance } from "../component.js"
import { shallowCompareObj } from "../helpers.js";

function patchElement(parentNode, nextNode, prevNode, prevChildren, index, level) {
    if (prevNode && prevNode.constructor === ElementNode && prevNode.el && prevNode.tag === nextNode.tag) {
        nextNode.el = prevNode.el;
        patch(nextNode, prevNode.children, nextNode.children, level)
        patchProps(prevNode, nextNode);
    } else {
        if (prevNode) {
            prevNode.unmount()
            prevNode = null
        }

        const el = document.createElement(nextNode.tag);
        nextNode.el = el;

        patch(nextNode, [], nextNode.children, level)
        patchProps(null, nextNode);
        
        parentNode.el.insertBefore(el, findAnchor(prevChildren, index) || parentNode.anchor || null);
    }
}

function patchText(parentNode, nextNode, prevNode, prevChildren, index) {
    if (prevNode && prevNode.constructor === TextNode && prevNode.el) {
        nextNode.el = prevNode.el;

        if (prevNode.text !== nextNode.text) {
            nextNode.el.nodeValue = nextNode.text
        }
    } else {
        if (prevNode) {
            prevNode.unmount()
        }

        const el = document.createTextNode(nextNode.text);
        nextNode.el = el;

        parentNode.el.insertBefore(el, findAnchor(prevChildren, index) || parentNode.anchor || null);
    }
}

function patchComponent(parentNode, nextNode, prevNode, index, level) {
    const isSameComponent = prevNode && prevNode.constructor === ComponentNode && prevNode.component === nextNode.component;

    if (isSameComponent && prevNode.instance) {
        nextNode.instance = prevNode.instance
        nextNode.instance.vnode = nextNode
    } else {
        nextNode.instance = new ComponentInstance(nextNode, level + 1)
    }

    if (
        isSameComponent
        && prevNode.el &&
        shallowCompareObj(
            prevNode.properties,
            nextNode.properties
        )
    ) {
        nextNode.el = prevNode.el;
        nextNode.children = prevNode.children;
        nextNode.index = index;
        nextNode.parent = parentNode;
    } else {

        // Set children as it's used for patching in rendering
        if (isSameComponent) {
            nextNode.children = prevNode.children;
        } else if (prevNode) {
            prevNode.unmount()
        }

        nextNode.index = index;
        nextNode.parent = parentNode;
        nextNode.el = parentNode.el;
        renderNode(nextNode, true)

        if (isSameComponent && typeof nextNode.component.onupdated === "function") {
            nextNode.component.onupdated.call(
                nextNode.instance,
                nextNode.properties
            )
        } else if (!isSameComponent && typeof nextNode.component.onmounted === "function") {
            nextNode.component.onmounted.call(
                nextNode.instance,
                nextNode.properties
            )
        }
    }
}

// Has responsibility for moving/removing keyed children.
// Handle case when nextChildren is bigger than prevChildren (perhaps fill with null)
function patchKeyed(prevChildren, nextChildren) {
    const tobeRemoved = [];
    const tobeMoved = [];

    const nextKeyed = new Map()

    for (var index = 0; index < nextChildren.length; index++) {
        const nextNode = nextChildren[index];
        if (!nextNode || (nextNode.constructor !== ElementNode && nextNode.constructor !== ComponentNode)) continue;
        const key = typeof nextNode.properties.key === "string" ? nextNode.properties.key : null;

        if (key) {
            if (nextKeyed.has(key)) throw Error(`Duplicate key: ${key}`)
            nextKeyed.set(key, index)
        }
    }

    for (var index = 0; index < prevChildren.length; index++) {
        const prevNode = prevChildren[index];
        if (!prevNode || (prevNode.constructor !== ElementNode && prevNode.constructor !== ComponentNode)) continue;
        const key = typeof prevNode.properties.key === "string" ? prevNode.properties.key : null;

        if (key) {
            // check else if not same type
            if (!nextKeyed.has(key)) {
                tobeRemoved.push(index)
            } else if (nextKeyed.get(key) !== index) {
                tobeMoved.push({key, index})
            }
        }
    }

    // Remove Old Keyed Children
    for (var index = (tobeRemoved.length - 1); index >= 0; index--) {
        const nodeIndex = tobeRemoved[index]
        const node = prevChildren[nodeIndex]
        node.unmount()

        prevChildren.splice(nodeIndex, 1)
    }

    // Move Old Keyed Children to New Index
}

export function patch(parentNode, prevChildren, nextChildren, level) {
    patchKeyed(prevChildren, nextChildren)

    for (var index = 0; index < nextChildren.length; index++) {
        const nextNode = nextChildren[index]
        const prevNode = prevChildren[index]

        if (nextNode === null || typeof nextNode !== "object") {
            if (prevNode) prevNode.unmount()
            continue;
        }
        
        if (nextNode.constructor === ElementNode) {
            patchElement(
                parentNode,
                nextNode,
                prevNode,
                prevChildren,
                index,
                level
            )
        } else if (nextNode.constructor === TextNode) {
            patchText(
                parentNode,
                nextNode,
                prevNode,
                prevChildren,
                index
            )
        } else if (nextNode.constructor === ComponentNode) {
            patchComponent(
                parentNode,
                nextNode,
                prevNode,
                index,
                level
            )
        }
    }

    // index should inheritely be set to nextChildren.length according to the previous loop
    for (var index = nextChildren.length; index < prevChildren.length; index++) {
        const item = prevChildren[index];

        if (item) item.unmount()
    }

    parentNode.children = nextChildren;

    // add functionality to remove unused old items, without confusing keyed
}