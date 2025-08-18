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

class DependencyManager {
    constructor() {
        this.subscriptions = new Map()
    }

    sub(target, func) {
        let subscribers = this.subscriptions.get(target)

        if (!subscribers) {
            subscribers = new Set()
            this.subscriptions.set(target, subscribers)
        }

        subscribers.add(func)
    }

    unsub(target, func) {
        const subscribers = this.subscriptions.get(target)
        if (!subscribers) return;

        subscribers.delete(func)

        if (subscribers.size === 0) {
            this.subscriptions.delete(target)
        }
    }
}

const effectStack = new EffectStack()
const depManager = new DependencyManager()

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
    constructor(renderFn) {
        this.renderFn = renderFn;
        this.children = [];

        this.parent = null;
        this.node = document.head;

        this.effects = new Set();
    }
}

export function head(attributes, ...children) {
    return new HeadContainer(attributes, children);
}

class BodyContainer {
    constructor(renderFn) {
        this.renderFn = renderFn;
        this.children = [];

        this.parent = null;
        this.node = document.body;

        this.effects = new Set();
    }
}

export function body(attributes, ...children) {
    return new BodyContainer(attributes, children);
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
    constructor(renderFn, properties) {
        this.renderFn = renderFn;
        this.properties = properties;

        this.parent = null;
        this.node = null;

        this.effects = new Set();
    }
}

// Create Component Virtual Node
export function c(component, properties) {
    return new ComponentNode(component, properties)
}

function patchElement(component, item, oldItem) {
    if (oldItem instanceof ElementNode && oldItem.node && oldItem.tag === item.tag) {

    } else {
        const el = document.createElement(item.tag);
        item.node = el;

        patch(item, oldItem ? oldItem.children : [], item.children)

        component.node.insertBefore(el, null);
    }
}

function patchText(component, item, oldItem) {
    if (oldItem instanceof ElementNode && oldItem.node && oldItem.tag === item.tag) {

    } else {
        const el = document.createTextNode(item.text);
        item.node = el;

        component.node.insertBefore(el, null);
    }
}

function patchComponent(component, item, oldItem) {
    if (oldItem.renderFn === item.renderFn && oldItem.node && oldItem.tag === item.tag) {

    } else {
        const el = document.createElement(item.tag);
        item.node = el;

        component.node.insertBefore(el, null);
    }
}

function patch(component, oldRender, newRender) {
    for (const index in newRender) {
        const item = newRender[index]
        const oldItem = oldRender[index]
        
        if (item instanceof ElementNode) {
            patchElement(component, item, oldItem)
        } else if (item instanceof TextNode) {
            patchText(component, item, oldItem)
        } else if (item instanceof ComponentNode) {

        }

        component.children.push(item)
        console.log(index, item)
    }
}

function runRender(component) {
    if (!component.node) return;

    effectStack.push((type, info) => {
        if (type !== "get") return;

        component.effects.add(info.target)
        depManager.sub(info.target, component)
    })

    const oldChildren = component.children;
    component.children = [];

    const rendered = component.renderFn()

    patch(component, oldChildren, rendered);

    effectStack.pop()
}

export class App {
    constructor(head, body) {
        this.head = head;
        this.body = body;
    }

    render() {
        runRender(this.head)
        runRender(this.body)
    }
}

export class Router {
    constructor() {

    }
}