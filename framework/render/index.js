import { ComponentNode, ElementNode, TextNode } from "../vnode.js";
import { ComponentInstance } from "../component.js"
import { refreshComponentAnchor, findAnchor } from "../anchor.js";

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

export const effectStack = new EffectStack()
export const depManager = new DependencyManager()
export const renderQueue = new RenderQueue()

function patchClassName(oldItem, item, value) {
    let computedClass = value;

    if (Array.isArray(value)) {
        
    }
}

function patchAttribute(oldItem, item, prop, value) {
    item.attributes.set(prop, value)

    if (oldItem && oldItem.attributes.get(prop) === value) return;

    if (prop === "class") {
        item.node.className = value
    } else {
        item.node.setAttribute(prop, value)
    }
}

function patchElementProperties(component, oldItem, item) {
    const patchedProps = new Set()
    for (const [prop, value] of Object.entries(item.properties)) {
        if (!value) continue;
        patchedProps.add(prop)

        if (prop.startsWith("on")) {
            const eventName = prop.substring(2);
            item.eventListeners.set(eventName, value)

            if (oldItem && oldItem.eventListeners.has(eventName)) {
                const oldEventListener = oldItem.eventListeners.get(eventName);
                if (oldEventListener === value) continue;

                oldItem.node.removeEventListener(eventName, oldEventListener)
                item.node.addEventListener(eventName, value)
            } else {
                item.node.addEventListener(eventName, value)
            }
        } else if (prop === "ref") {
            item.refFn = value;
            
            if (oldItem && oldItem.refFn) {
                if (oldItem.refFn === value) continue;

                oldItem.refFn(null)
                value(item.node)
            } else {
                value(item.node)
            }
        } else {
            if (prop === "class") {
                patchAttribute(oldItem, item, "class", Array.isArray(value) ? value.join(" ") : value)
            } else {
                patchAttribute(oldItem, item, prop, value)
            }
        }
    }
}

function patchElement(component, item, oldItem, oldRender, index) {
    if (oldItem instanceof ElementNode && oldItem.node && oldItem.tag === item.tag) {
        item.node = oldItem.node;
        patch(item, oldItem.children, item.children)
        patchElementProperties(component, oldItem, item);
    } else {
        if (oldItem) {
            oldItem.unmount()
            oldItem = null
        }

        const el = document.createElement(item.tag);
        item.node = el;

        patch(item, [], item.children)

        component.node.insertBefore(el, findAnchor(oldRender, Number(index)), component);
        patchElementProperties(component, null, item);
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

        component.node.insertBefore(el, findAnchor(oldRender, Number(index)), component);
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

    const rendered = component.renderFn.call(component.instance, component.properties)

    patch(component, oldChildren, rendered);

    effectStack.pop()

    console.log("Render Time", performance.now() - startTime, component)
}