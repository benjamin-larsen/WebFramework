class EffectStack {
    constructor() {
        this.stack = [];
    }

    push(func) {
        this.stack.push(func)
    }

    pop() {
        this.stack.pop()
    }

    getActiveEffect() {
        if (this.stack.length >= 1) {
            // get top of stack
            return this.stack[this.stack.length - 1]
        }

        return null
    }
}

const effectStack = new EffectStack()

export function reactive(target) {
    return new Proxy(target, {
        get(target, prop, receiver) {
            const currentEffect = effectStack.getActiveEffect();

            if (currentEffect) {
                currentEffect("get", {target, prop, receiver})
            }

            return target[prop];
        },
        set(target, prop, value, receiver) {
            const currentEffect = effectStack.getActiveEffect();

            if (currentEffect) {
                currentEffect("set", {target, prop, value, receiver})
            }

            target[prop] = value;
            return true;
        }
    });
}

class HeadContainer {
    constructor(attributes, children) {
        this.attributes = attributes;
        this.children = children;

        this.parent = null;
        this.node = document.head;
    }
}

export function head(attributes, ...children) {
    return new HeadContainer(attributes, children);
}

class BodyContainer {
    constructor(attributes, children) {
        this.attributes = attributes;
        this.children = children;

        this.parent = null;
        this.node = document.body;
    }
}

export function body(attributes, ...children) {
    return new BodyContainer(attributes, children);
}

class HTMLContainer {
    constructor(head, body) {
        this.parent = document;
        this.node = document.documentElement;

        this.head = head;
        this.body = body;
    }
}

export function html(head, body) {
    return new HTMLContainer(head, body)
}

class ElementNode {
    constructor(tag, attributes, children) {
        this.tag = tag;
        this.attributes = attributes;
        this.children = children;

        this.parent = null;
        this.node = null;
    }
}

// Create Element Virtual Node
export function e(tag, attributes, ...children) {
    return new ElementNode(tag, attributes, children)
}

class TextNode {
    constructor(text) {
        this.text = text;

        this.parent = null;
        this.node = null;
    }
}

// Create Text Virtual Node
export function t(text) {
    return new TextNode(text)
}

class ComponentNode {
    constructor(component, properties) {
        this.component = component;
        this.properties = properties;

        this.parent = null;
        this.node = null;
    }
}

// Create Component Virtual Node
export function c(component, properties) {
    return new ComponentNode(component, properties)
}

export class App {
    constructor(html) {
        this.html = html;
    }

    render() {

    }
}

export class Router {
    constructor() {

    }
}