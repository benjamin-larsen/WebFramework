import { ComponentInstance } from "./component.js";
import standardComponents from "./standardComponents/index.js";

export class RootContainer {
    constructor(component, el) {
        this.component = component;
        this.children = [];

        this.el = el;

        this.instance = new ComponentInstance(this, 0);
    }
}

export function root(component, queryOrElement) {
    let element = queryOrElement;

    if (typeof queryOrElement === 'string') {
        element = document.querySelector(queryOrElement)
    }

    if (!(element instanceof HTMLElement)) throw Error("Invalid Root Element");

    return new RootContainer(component, element)
}

export class HeadContainer extends RootContainer {
    constructor(component) {
        super(component, document.head);
    }
}

export function head(component) {
    return new HeadContainer(component);
}

export class BodyContainer extends RootContainer {
    constructor(component) {
        super(component, document.body);
    }
}

export function body(component) {
    return new BodyContainer(component);
}

export class ElementNode {
    constructor(tag, properties, children) {
        this.tag = tag;
        this.properties = properties;
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

        if (Array.isArray(this.properties.directives)) {
            for (const directive of this.properties.directives) {
                if (typeof directive.onDestroy === 'function') {
                    directive.onDestroy(this.el, this)
                }
            }
        }

        this.el.remove();
        this.el = null;
        this.children = null;
    }
}

// Create Element Virtual Node
export function createElement(tag, attributes, ...children) {
    return new ElementNode(tag, attributes, children)
}

export const e = createElement

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
export function createTextNode(text) {
    return new TextNode(text)
}

export const t = createTextNode

export class ComponentNode {
    constructor(component, properties) {
        this.component = component;
        this.properties = Object.freeze(properties);

        if (Array.isArray(this.properties.directives)) {
            console.warn("Directive(s) were defined in a ComponentNode, but directives are not supported for Components.")
        }

        this.children = [];
        this.parent = null;

        this.index = null;
        this.anchor = null;
        this.el = null;
        this.instance = null;
    }

    unmount() {
        this.anchor = null;

        for (const child of this.children) {
            if (!child) continue;
            child.unmount()
        }

        // Prevent Memory Leak
        this.parent = null;
        this.children = null;

        // Call unmount hook before instance is destroyed.
        this.instance.callHook("onDestroy")

        this.instance.destroy();
        this.instance = null;
    }
}

// Create Component Virtual Node
export function createComponent(component, properties) {
    if (typeof component === "string" && standardComponents[component]) {
        return new ComponentNode(standardComponents[component], properties)
    }

    return new ComponentNode(component, properties)
}

export const c = createComponent

// Create Virtual Node (inferred)
// Element: v(tag, attributes?, text?, ...children)
// Component: v(component, properties?)
export function createVNode(type, ...data) {
    switch (typeof type) {
        case "string": {
            if (standardComponents[type]) {
                return new ComponentNode(standardComponents[type], data[0] || {})
            }

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

export const v = createVNode