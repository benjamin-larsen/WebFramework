import { ComponentInstance } from "./component.js";

export class HeadContainer {
    constructor(component) {
        this.component = component;
        this.children = [];

        this.el = document.head;

        this.instance = new ComponentInstance(this, 0);
    }
}

export function head(component) {
    return new HeadContainer(component);
}

export class BodyContainer {
    constructor(component) {
        this.component = component;
        this.children = [];

        this.el = document.body;

        this.instance = new ComponentInstance(this, 0);
    }
}

export function body(component) {
    return new BodyContainer(component);
}

export class ElementNode {
    constructor(tag, properties, children) {
        this.tag = tag;
        this.properties = Object.assign({}, properties);
        this.children = children;

        this.el = null;
    }

    unmount() {
        if (!this.el) return;

        for (const child of this.children) {
            if (!child) continue;
            child.unmount()
        }

        if (this.refFn) {
            this.refFn(null)
        }

        this.el.remove();
        this.el = null;
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

        this.el = null;
    }

    unmount() {
        if (!this.el) return;

        this.el.remove();
        this.el = null;
    }
}

// Create Text Virtual Node
export function t(text) {
    return new TextNode(text)
}

export class ComponentNode {
    constructor(component, properties) {
        this.component = component;
        this.properties = Object.assign({}, properties);
        this.children = [];
        this.parent = null;

        this.index = null;
        this.anchor = null;
        this.el = null;
        this.instance = null;
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

        if (isSameComponent && typeof this.component.onupdated === "function") {
            this.component.onupdated.apply(
                this.instance
            )
        }
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

            if (data[0] !== null && typeof data[0] === 'object' && data[0].constructor === Object) {
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

        case "object": {
            if (type === null) return null;

            return new ComponentNode(type, data[0] || {})
        }

        default: {
            return null
        }
    }
}