import { runRender } from "./index.js";
import { findAnchor, resolveAnchor } from "../anchor.js";
import { patchElementProperties } from "./patchProps.js";
import { ComponentNode, ElementNode, TextNode } from "../vnode.js";
import { ComponentInstance } from "../component.js"

function patchElement(parentNode, nextNode, prevNode, prevChildren, index) {
    if (prevNode instanceof ElementNode && prevNode.el && prevNode.tag === nextNode.tag) {
        nextNode.el = prevNode.el;
        patch(nextNode, prevNode.children, nextNode.children)
        patchElementProperties(prevNode, nextNode);
    } else {
        if (prevNode) {
            prevNode.unmount()
            prevNode = null
        }

        const el = document.createElement(nextNode.tag);
        nextNode.el = el;

        patch(nextNode, [], nextNode.children)

        parentNode.el.insertBefore(el, resolveAnchor(findAnchor(prevChildren, Number(index)), parentNode));
        patchElementProperties(null, nextNode);
    }
}

function patchText(parentNode, nextNode, prevNode, prevChildren, index) {
    if (prevNode instanceof TextNode && prevNode.el) {
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

        parentNode.el.insertBefore(el, resolveAnchor(findAnchor(prevChildren, Number(index)), parentNode));
    }
}

function patchComponent(parentNode, nextNode, prevNode, index) {
    const isSameComponent = prevNode instanceof ComponentNode && prevNode.renderFn === nextNode.renderFn;

    if (isSameComponent && prevNode.instance) {
        nextNode.instance = prevNode.instance
        nextNode.instance.vnode = nextNode
    } else {
        nextNode.instance = new ComponentInstance(nextNode)
    }

    if (isSameComponent && prevNode.el) {
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
        runRender(nextNode)
    }
}

export function patch(parentNode, prevChildren, nextChildren) {
    for (var index = 0; index < nextChildren.length; index++) {
        const nextNode = nextChildren[index]
        const prevNode = prevChildren[index]
        
        if (nextNode instanceof ElementNode) {
            patchElement(
                parentNode,
                nextNode,
                prevNode,
                prevChildren,
                index
            )
        } else if (nextNode instanceof TextNode) {
            patchText(
                parentNode,
                nextNode,
                prevNode,
                prevChildren,
                index
            )
        } else if (nextNode instanceof ComponentNode) {
            patchComponent(
                parentNode,
                nextNode,
                prevNode,
                index
            )
        } else if (prevNode) {
            prevNode.unmount()
        }
    }

    for (var index = nextChildren.length; index < prevChildren.length; index++) {
        const item = prevChildren[index];

        if (item) item.unmount()
    }

    parentNode.children = nextChildren;

    // add functionality to remove unused old items, without confusing keyed
}