import { runRender } from "./index.js";
import { findAnchor, resolveAnchor } from "../anchor.js";
import { patchElementProperties } from "./patchProps.js";
import { ComponentNode, ElementNode, TextNode } from "../vnode.js";
import { ComponentInstance } from "../component.js"

function patchElement(component, nextNode, prevNode, oldRender, index) {
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

        component.el.insertBefore(el, resolveAnchor(findAnchor(oldRender, Number(index)), component));
        patchElementProperties(null, nextNode);
    }
}

function patchText(component, nextNode, prevNode, oldRender, index) {
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

        component.el.insertBefore(el, resolveAnchor(findAnchor(oldRender, Number(index)), component));
    }
}

function patchComponent(component, nextNode, prevNode, oldRender, index) {
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
        nextNode.parent = component;
    } else {

        // Set children as it's used for patching in rendering
        if (isSameComponent) {
            nextNode.children = prevNode.children;
        } else if (prevNode) {
            prevNode.unmount()
        }

        nextNode.index = index;
        nextNode.parent = component;
        nextNode.el = component.el;
        runRender(nextNode)
    }
}

export function patch(component, oldRender, newRender) {
    for (var index = 0; index < newRender.length; index++) {
        const nextNode = newRender[index]
        const prevNode = oldRender[index]
        
        if (nextNode instanceof ElementNode) {
            patchElement(component, nextNode, prevNode, oldRender, index)
        } else if (nextNode instanceof TextNode) {
            patchText(component, nextNode, prevNode, oldRender, index)
        } else if (nextNode instanceof ComponentNode) {
            patchComponent(component, nextNode, prevNode, oldRender, index)
        } else if (prevNode) {
            prevNode.unmount()
        }
    }

    component.children = newRender;

    // add functionality to remove unused old items, without confusing keyed
}