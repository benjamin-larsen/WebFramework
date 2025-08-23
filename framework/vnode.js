import { ComponentInstance } from "./component.js";

export class HeadContainer {
    constructor(renderFn) {
        this.renderFn = renderFn;
        this.children = [];

        this.node = document.head;

        this.instance = new ComponentInstance(this);
    }
}

export function head(attributes, ...children) {
    return new HeadContainer(attributes, children);
}

export class BodyContainer {
    constructor(renderFn) {
        this.renderFn = renderFn;
        this.children = [];

        this.node = document.body;

        this.instance = new ComponentInstance(this);
    }
}

export function body(attributes, ...children) {
    return new BodyContainer(attributes, children);
}

export class ElementNode {
    constructor(tag, properties, children) {
        this.tag = tag;
        this.properties = properties;
        this.children = children;

        this.refFn = null;
        this.attributes = new Map();
        this.eventListeners = new Map();

        this.node = null;
    }

    unmount() {
        if (!this.node) return;

        for (const child of this.children) {
            if (!child) continue;
            child.unmount()
        }

        if (this.refFn) {
            this.refFn(null)
        }

        this.node.remove();
        this.node = null;
        this.children = null;
    }
}

// Create Element Virtual Node
export function e(tag, attributes, ...children) {
    return new ElementNode(tag, attributes, children)
}

export class TextNode {
    constructor(text) {
        this.text = text;

        this.node = null;
    }

    unmount() {
        if (!this.node) return;

        this.node.remove();
        this.node = null;
    }
}

// Create Text Virtual Node
export function t(text) {
    return new TextNode(text)
}

export class ComponentNode {
    constructor(renderFn, properties) {
        this.renderFn = renderFn;
        this.properties = properties;
        this.children = [];
        this.parent = null;

        this.index = null;
        this.anchor = null;
        this.node = null;
        this.instance = null;

        this.effects = new Set();
    }

    unmount() {
        this.instance.destroy();
        this.instance = null;
        this.anchor = null;

        for (const child of this.children) {
            if (!child) continue;
            child.unmount()
        }

        // Prevent Memory Leak
        this.parent = null;
        this.children = null;
    }
}

// Create Component Virtual Node
export function c(component, properties) {
    return new ComponentNode(component, properties)
}

// Create Virtual Node (inferred)
// Element: v(tag, attributes?, text?, ...children)
// Component: v(component, properties?)
export function v(type, ...data) {
    switch (typeof type) {
        case "string": {
            let children = [];
            let properties = {};

            if (typeof data[0] === 'object') {
                properties = data[0];
                data = data.slice(1);
            }

            for (const child of data) {
                if (typeof child === 'string') {
                    children.push(new TextNode(child))
                } else {
                    children.push(child)
                }
            }

            return new ElementNode(type, properties, children)
        }

        case "function": {
            return new ComponentNode(type, data[0] || {})
        }

        default: {
            return null
        }
    }
}