import { renderNode } from "./index.js";
import { findAnchor } from "../anchor.js";
import { patchProps } from "./patchProps.js";
import { ComponentNode, ElementNode, TextNode } from "../vnode.js";
import { ComponentInstance } from "../component.js"
import { shallowCompareObj } from "../helpers.js";

function isSameNode(prev, next) {
    if (!prev) return false;

    const nextKey = next.properties ? next.properties.key : null;
    const prevKey = prev.properties ? prev.properties.key : null;

    if (prevKey !== nextKey) return false;

    if (next.constructor === ElementNode) {
        if (prev.constructor !== ElementNode) return false;
        if (next.tag !== prev.tag) return false;
    } else if (next.constructor === ComponentNode) {
        if (prev.constructor !== ComponentNode) return false;
        if (next.component !== prev.component) return false;
    } else if (next.constructor === TextNode) {
        if (prev.constructor !== TextNode) return false;
    } else {
        return false;
    }

    return true;
}

const NO_SEEK = {
    shouldMove: true,
    prevNode: null
}

class NodeSeeker {
    constructor(parentNode, children) {
        this.parentNode = parentNode;
        this.children = children;
        this.firstNode = null;
        this.firstIndex = null;
        this.firstAnchor = null;

        this.seekFirstNode(0);
    }

    seekFirstNode(seekStart = 0) {
        for (var i = seekStart; i < this.children.length; i++) {
            if (this.children[i]) {
                this.firstNode = this.children[i];
                this.firstIndex = i;
                this.firstAnchor = findAnchor(this.children, i - 1) || this.parentNode.anchor || null;

                return;
            }
        }

        this.firstNode = null;
        this.firstIndex = null;
        this.firstAnchor = this.parentNode.anchor || null;
    }

    seekNode(nextNode) {
        if (this.firstIndex === null) return NO_SEEK;

        for (var i = this.firstIndex; i < this.children.length; i++) {
            const prevNode = this.children[i]

            if (isSameNode(prevNode, nextNode)) {
                this.children[i] = null;
                const isFirst = (i === this.firstIndex);

                if (isFirst) {
                    this.seekFirstNode(this.firstIndex)
                }

                return {
                    shouldMove: !isFirst,
                    prevNode
                };
            }
        }

        return NO_SEEK;
    }
}

function patchElement(seeker, nextNode, level) {
    const { shouldMove, prevNode } = seeker.seekNode(nextNode);

    if (prevNode) {
        nextNode.el = prevNode.el;

        if (shouldMove) {
            seeker.parentNode.el.insertBefore(nextNode.el, seeker.firstAnchor);
        }

        patch(nextNode, prevNode.children, nextNode.children, level)
        patchProps(prevNode, nextNode);
    } else {
        const el = document.createElement(nextNode.tag);
        nextNode.el = el;

        patch(nextNode, [], nextNode.children, level)
        patchProps(null, nextNode);
        
        seeker.parentNode.el.insertBefore(el, seeker.firstAnchor);
    }
}

function patchText(seeker, nextNode, index) {
    const { shouldMove, prevNode } = seeker.seekNode(nextNode);

    if (prevNode) {
        nextNode.el = prevNode.el;

        if (shouldMove) {
            seeker.parentNode.el.insertBefore(nextNode.el, seeker.firstAnchor);
        }

        if (prevNode.text !== nextNode.text) {
            nextNode.el.nodeValue = nextNode.text
        }
    } else {
        const el = document.createTextNode(nextNode.text);
        nextNode.el = el;

        seeker.parentNode.el.insertBefore(el, seeker.firstAnchor);
    }
}

function moveComponent(node, anchor) {
    for (const child of node.children) {
        if (child === null) continue;

        if (child.constructor === ElementNode || child.constructor === TextNode) {
            node.el.insertBefore(child.el, anchor);
        } else if (child.constructor === ComponentNode) {
            moveComponent(child, anchor)
        }
    }
}

function patchComponent(seeker, nextNode, index, level) {
    const { shouldMove, prevNode } = seeker.seekNode(nextNode);

    if (prevNode) {
        nextNode.instance = prevNode.instance
        nextNode.instance.vnode = nextNode

        if (shouldMove) {
            moveComponent(prevNode, seeker.firstAnchor)
        }
    } else {
        nextNode.instance = new ComponentInstance(nextNode, level + 1)
    }

    if (
        prevNode &&
        shallowCompareObj(
            prevNode.properties,
            nextNode.properties
        )
    ) {
        nextNode.el = prevNode.el;
        nextNode.children = prevNode.children;
        nextNode.index = index;
        nextNode.parent = seeker.parentNode;
    } else {

        // Set children as it's used for patching in rendering
        if (prevNode) {
            nextNode.children = prevNode.children;
        }

        nextNode.index = index;
        nextNode.parent = seeker.parentNode;
        nextNode.el = seeker.parentNode.el;
        renderNode(nextNode, true)

        if (prevNode && typeof nextNode.component.onupdated === "function") {
            nextNode.component.onupdated.call(
                nextNode.instance,
                nextNode.properties
            )
        } else if (!prevNode && typeof nextNode.component.onmounted === "function") {
            nextNode.component.onmounted.call(
                nextNode.instance,
                nextNode.properties
            )
        }
    }
}

export function patch(parentNode, prevChildren, nextChildren, level) {
    const seeker = new NodeSeeker(parentNode, prevChildren);

    for (var index = 0; index < nextChildren.length; index++) {
        const nextNode = nextChildren[index]
        
        if (nextNode === null) continue;
        
        if (nextNode.constructor === ElementNode) {
            patchElement(
                seeker,
                nextNode,
                level
            )
        } else if (nextNode.constructor === TextNode) {
            patchText(
                seeker,
                nextNode,
                index
            )
        } else if (nextNode.constructor === ComponentNode) {
            patchComponent(
                seeker,
                nextNode,
                index,
                level
            )
        }
    }

    if (seeker.firstIndex) {
        for (var index = seeker.firstIndex; index < seeker.children.length; index++) {
            const item = seeker.children[index];

            if (item) item.unmount()
        }
    }

    parentNode.children = nextChildren;

    // add functionality to remove unused old items, without confusing keyed
}