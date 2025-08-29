import { renderQueue } from "./render/index.js"
export { head, body, e, t, c, v } from "./vnode.js"
export { reactive } from "./reactive.js"

import { BodyContainer, HeadContainer, ElementNode, ComponentNode, TextNode } from "./vnode.js"

function printVNode(node, indent = "") {
    if (node instanceof BodyContainer) {
        console.log(`${indent}<body>`)
    } else if (node instanceof HeadContainer) {
        console.log(`${indent}<head>`)
    } else if (node instanceof ElementNode) {
        console.log(`${indent}<${node.tag}>`)
    } else if (node instanceof ComponentNode) {
        console.log(`${indent}<Component`, node.component, ">")
    } else if (node instanceof TextNode) {
        console.log(`${indent}#text ${node.text}`)
    } else {
        console.log(`${indent} <empty slot>`)
    }

    if (node && node.children) {
        for (const child of node.children) {
            printVNode(child, indent + "  ")
        }
    }
}

export class App {
    constructor(...children) {
        this.children = children;
    }

    render() {
        for (const child of this.children) {
            renderQueue.queue(child.instance)
        }
    }

    print() {
        for (const child of this.children) {
            printVNode(child)
        }
    }
}
