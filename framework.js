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

    trigger(target) {
        const subscribers = this.subscriptions.get(target)
        if (!subscribers) return;

        for (const sub of subscribers) {
            renderQueue.queue(sub)
        }
    }
}

class RenderQueue {
    constructor() {
        this.waiting = new Set();
        this.renderId = null;
    }

    process() {
        for (const component of this.waiting) {
            runRender(component);
        }

        this.waiting.clear();
        this.renderId = null;
    }

    queue(component) {
        this.waiting.add(component)

        if (!this.renderId) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        }
    }
}

const effectStack = new EffectStack()
const depManager = new DependencyManager()
const renderQueue = new RenderQueue()

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

            depManager.trigger(target)

            return true;
        }
    });
}

class HeadContainer {
    constructor(renderFn) {
        this.renderFn = renderFn;
        this.children = [];

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

        this.node = null;
    }

    unmount() {
        if (!this.node) return;

        for (const child of this.children) {
            child.unmount()
        }
    }
}

// Create Element Virtual Node
export function e(tag, attributes, ...children) {
    return new ElementNode(tag, attributes, children)
}

class TextNode {
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

class ComponentNode {
    constructor(renderFn, properties) {
        this.renderFn = renderFn;
        this.properties = properties;
        this.children = [];
        this.parent = null;

        this.index = null;
        this.anchor = null;
        this.node = null;

        this.effects = new Set();
    }

    removeEffects() {
        for (const effect of this.effects) {
            depManager.unsub(effect, this);
        }

        this.effects.clear()
    }

    unmount() {
        this.removeEffects()
        this.anchor = null

        for (const child of this.children) {
            child.unmount()
        }
    }
}

// Create Component Virtual Node
export function c(component, properties) {
    return new ComponentNode(component, properties)
}

function findAnchor(oldRender, index) {
    for (var i = (index + 1); i < oldRender.length; i++) {
        const item = oldRender[i]
        if (!item) continue;

        if (item instanceof ComponentNode) {
            const anchor = findAnchor(item.children, -1);
            if (anchor) return anchor
        } else {
            return item.node
        }
    }

    return null;
}

function resolveAnchor(anchor, parent) {
    if (anchor) return anchor

    if (parent.anchor instanceof ComponentNode) {
        return parent.anchor.anchor
    } else if (parent.anchor) {
        return parent.anchor
    }

    return null
}

function patchElement(component, item, oldItem, oldRender, index) {
    if (oldItem instanceof ElementNode && oldItem.node && oldItem.tag === item.tag) {
        item.node = oldItem.node;
        patch(item, oldItem.children, item.children)
    } else {
        if (oldItem) {
            oldItem.unmount()
        }

        const el = document.createElement(item.tag);
        item.node = el;

        patch(item, oldItem ? oldItem.children : [], item.children)

        component.node.insertBefore(el, resolveAnchor(findAnchor(oldRender, Number(index)), component));
    }
}

function patchText(component, item, oldItem, oldRender, index) {
    if (oldItem instanceof TextNode && oldItem.node) {
        item.node = oldItem.node;

        if (oldItem.text !== item.text) {
            item.node.nodeValue = item.text
        }
    } else {
        if (oldItem) {
            oldItem.unmount()
        }

        const el = document.createTextNode(item.text);
        item.node = el;

        component.node.insertBefore(el, resolveAnchor(findAnchor(oldRender, Number(index)), component));
    }
}

function patchComponent(component, item, oldItem, oldRender, index) {
    if (oldItem instanceof ComponentNode && oldItem.renderFn === item.renderFn && oldItem.node) {
        item.node = oldItem.node;
        item.children = oldItem.children;
        item.index = index;
        item.parent = component;
    } else {
        if (oldItem) {
            oldItem.removeEffects()
            item.children = oldItem.children;
        }

        item.index = index;
        item.parent = component;
        item.node = component.node;
        runRender(item)
    }
}

function patch(component, oldRender, newRender) {
    for (var index = 0; index < newRender.length; index++) {
        const item = newRender[index]
        const oldItem = oldRender[index]
        
        if (item instanceof ElementNode) {
            patchElement(component, item, oldItem, oldRender, index)
        } else if (item instanceof TextNode) {
            patchText(component, item, oldItem, oldRender, index)
        } else if (item instanceof ComponentNode) {
            patchComponent(component, item, oldItem, oldRender, index)
        } else if (oldItem) {
            oldItem.unmount()
        }
    }

    component.children = newRender;

    // add functionality to remove unused old items, without confusing keyed
}

function refreshComponentAnchor(component, noRecursion) {
    const anchor = findAnchor(component.parent.children, component.index);

    if (anchor) {
        component.anchor = anchor
    } else if (!noRecursion) {
        const parentAnchor = component.parent.anchor;

        if (parentAnchor instanceof ComponentNode) {
            component.anchor = parentAnchor
        } else {
            component.anchor = component.parent
        }

        if (parentAnchor) {
            refreshComponentAnchor(component.anchor, true)
        }
    } else {
        component.anchor = null
    }
}

function runRender(component) {
    const startTime = performance.now()

    if (!component.node) return;
    
    if (component instanceof ComponentNode) {
        refreshComponentAnchor(component)
    }

    // clean up old effects that for some reason arent here this time
    effectStack.push((type, info) => {
        if (type !== "get") return;

        component.effects.add(info.target)
        depManager.sub(info.target, component)
    })

    const oldChildren = component.children;

    const rendered = component.renderFn(component.properties)

    patch(component, oldChildren, rendered);

    effectStack.pop()

    console.log("Render Time", performance.now() - startTime, component)
}

export class App {
    constructor(head, body) {
        this.head = head;
        this.body = body;
    }

    render() {
        renderQueue.queue(this.head)
        renderQueue.queue(this.body)
    }
}

export class Router {
    constructor() {

    }
}