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
        const items = [...this.waiting];
        this.waiting.clear();
        this.processing = true;

        for (const componentInstance of items) {
            if (!componentInstance.vnode) continue;

            runRender(componentInstance.vnode);
        }

        if (this.waiting.size > 0) {
            this.renderId = requestAnimationFrame(this.process.bind(this));
        } else {
            this.renderId = null;
        }
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

window.depManager = depManager
window.effectStack = effectStack
window.renderQueue = renderQueue

const reactiveHandler = {
    get(target, prop, receiver) {
        const currentEffect = effectStack.getActiveEffect();

        if (currentEffect) {
            currentEffect("get", {target, prop, receiver})
        }

        const value = target[prop];

        if (false && value !== null && typeof value === 'object') {
            return reactive(value)
        } else {
            return value
        }

        return target[prop];
    },
    set(target, prop, value, receiver) {
        const currentEffect = effectStack.getActiveEffect();

        if (currentEffect) {
            currentEffect("set", {target, prop, value, receiver})
        }

        const shouldTrigger = target[prop] !== value;

        target[prop] = value;

        if (shouldTrigger) {
            depManager.trigger(target)
        }

        return true;
    }
}

export function reactive(target) {
    return new Proxy(target, reactiveHandler);
}

class ComponentInstance {
    constructor(vnode) {
        this.vnode = vnode;

        this.effects = new Set();
    }

    $forceUpdate() {
        renderQueue.queue(this)
    }

    cleanEffects() {
        for (const effect of this.effects) {
            depManager.unsub(effect, this);
        }

        this.effects.clear()
    }

    destroy() {
        this.cleanEffects()
        this.vnode = null;
    }
}

class HeadContainer {
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

class BodyContainer {
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

class ElementNode {
    constructor(tag, properties, children) {
        this.tag = tag;
        this.properties = properties;
        this.children = children;

        this.refFn = null;
        this.attributes = {};
        this.eventListeners = {};

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

// Make better and more efficent system later, perhaps using two-phase rendering
function findComponentAnchor(component) {
    if (!(component instanceof ComponentNode)) return null;
    const anchor = findAnchor(component.parent.children, component.index)

    if (anchor) {
        return anchor;
    } else {
        return findComponentAnchor(component.parent)
    }
}

window.findComponentAnchor = findComponentAnchor

function resolveAnchor(anchor, parent) {
    if (anchor) return anchor

    if (parent.anchor instanceof ComponentNode) {
        return parent.anchor.anchor
    } else if (parent.anchor) {
        return parent.anchor
    }

    return null
}

function patchAttributes(component, oldItem, item) {

}

function patchElement(component, item, oldItem, oldRender, index) {
    if (oldItem instanceof ElementNode && oldItem.node && oldItem.tag === item.tag) {
        item.node = oldItem.node;
        patch(item, oldItem.children, item.children)
    } else {
        if (oldItem) {
            oldItem.unmount()
            oldItem = null
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
    const isSameComponent = oldItem instanceof ComponentNode && oldItem.renderFn === item.renderFn;

    if (isSameComponent && oldItem.instance) {
        item.instance = oldItem.instance
        item.instance.vnode = item
    } else {
        item.instance = new ComponentInstance(item)
    }

    if (isSameComponent && oldItem.node) {
        item.node = oldItem.node;
        item.children = oldItem.children;
        item.index = index;
        item.parent = component;
    } else {

        // Set children as it's used for patching in rendering
        if (isSameComponent) {
            item.children = oldItem.children;
        } else if (oldItem) {
            oldItem.unmount()
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
        /*const parentAnchor = component.parent.anchor;

        if (parentAnchor instanceof ComponentNode) {
            component.anchor = parentAnchor
            refreshComponentAnchor(component.anchor, true)
        } else if (component.parent instanceof ComponentNode) {
            component.anchor = component.parent
            refreshComponentAnchor(component.anchor, true)
        } else {
            component.anchor = null
        }*/
       component.anchor = findComponentAnchor(component.parent)
    } else {
        component.anchor = null
    }
}

function runRender(component) {
    const startTime = performance.now()

    if (!component.instance) return;
    
    if (component instanceof ComponentNode) {
        refreshComponentAnchor(component)
    }

    component.instance.cleanEffects()

    effectStack.push((type, info) => {
        if (type !== "get") return;

        component.instance.effects.add(info.target)
        depManager.sub(info.target, component.instance)
    })

    const oldChildren = component.children;

    const rendered = component.renderFn(component.properties)

    patch(component, oldChildren, rendered);

    effectStack.pop()

    //window.time = performance.now() - startTime
    console.log("Render Time", performance.now() - startTime, component)
}

function printVNode(node, indent = "") {
    if (node instanceof BodyContainer) {
        console.log(`${indent}<body>`)
    } else if (node instanceof HeadContainer) {
        console.log(`${indent}<head>`)
    } else if (node instanceof ElementNode) {
        console.log(`${indent}<${node.tag}>`)
    } else if (node instanceof ComponentNode) {
        console.log(`${indent}<Component ${node.renderFn.name}>`)
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

export class Router {
    constructor() {

    }
}