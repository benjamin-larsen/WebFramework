import { RESERVED_PROPS } from "../constants.js";

function patchClassName(prevNode, nextNode, classList) {
    let computedClass = classList || "";

    if (Array.isArray(classList)) {
        computedClass = classList.join(" ")
    } else if (typeof classList === "object") {
        let classArray = [];

        for (const name in classList) {
            if (classList[name]) classArray.push(name)
        }

        computedClass = classArray.join(" ")
    }

    nextNode.properties.class = computedClass;

    if (prevNode && prevNode.properties.class === computedClass) return;

    nextNode.el.className = computedClass
}

function patchAttribute(prevNode, nextNode, attr, value) {
    const hasPrevAttr = prevNode && prevNode.properties[attr];

    if (value === null || value === undefined) {
        if (hasPrevAttr && prevNode.el) {
            prevNode.el.removeAttribute(attr)
        }

        return
    }

    if (hasPrevAttr && prevNode.properties[attr] === value) return;

    nextNode.el.setAttribute(attr, value)
}

function createInvoker(func, node) {
    function invoker(...args) {
        if (!invoker.func) return;
        invoker.func.apply(
            invoker.node,
            args
        )
    }

    invoker.node = node;
    invoker.func = func;

    return invoker;
}

function patchEvent(prevNode, nextNode, propName, listenerFn) {
    const eventName = propName.substring(2)
    const hasPrevInvoker = prevNode && prevNode.properties[propName];

    if (typeof listenerFn !== 'function') {
        if (hasPrevInvoker && prevNode.el) {
            prevNode.el.removeEventListener(
                eventName,
                prevNode.properties[propName]
            )
        }

        return;
    }

    if (hasPrevInvoker) {
        const invoker = prevNode.properties[propName];
        nextNode.properties[propName] = invoker;
        
        invoker.func = listenerFn;
        invoker.node = nextNode;
    } else {
        const invoker = createInvoker(listenerFn, nextNode);
        nextNode.properties[propName] = invoker;

        nextNode.el.addEventListener(eventName, invoker)
    }
}

function patchDirectives(prevNode, nextNode, directives) {
    const hasNew = Array.isArray(directives);
    const hasOld = prevNode && Array.isArray(prevNode.properties.directives);

    if (hasNew) {
        for (const directive of directives) {
            const isNew = !prevNode || (!prevNode.properties.directives.includes(directive))

            if (isNew) {
                if (typeof directive.onMounted === 'function') {
                    directive.onMounted(nextNode.el, nextNode)
                }
            } else if (typeof directive.onUpdated === 'function') {
                directive.onUpdated(nextNode.el, nextNode)
            }
        }
    } else if (hasOld) {
        for (const directive of prevNode.properties.directives) {
            if (typeof directive.onDestroy === 'function') {
                directive.onDestroy(nextNode.el, nextNode)
            }
        }
    }

    if (hasNew && hasOld) {
        for (const directive of prevNode.properties.directives) {
            if (
                !directives.includes(directive) &&
                typeof directive.onDestroy === 'function'
            ) {
                directive.onDestroy(nextNode.el, nextNode)
            }
        }
    }
}

export function patchProp(prevNode, nextNode, prop, value) {
    if (RESERVED_PROPS.has(prop)) return;

    if (prop.startsWith("on")) {
            patchEvent(
                prevNode,
                nextNode,
                prop, // Prop Name
                value // Listener Function
            )
        } else if (prop === "directives") {
            patchDirectives(prevNode, nextNode, value)
        } else if (prop === "ref") {            
            if (prevNode && typeof prevNode.properties.ref === 'function') {
                if (prevNode.properties.ref === value) return;

                prevNode.properties.ref(null)
            }

            if (typeof value === 'function') {
                value(nextNode.el)
            }
        } else if (prop === "class") {
            patchClassName(
                prevNode,
                nextNode,
                value
            )
        } else if (prop === "value") {
            if (!prevNode || !prevNode.el || prevNode.el.value !== value) {
                nextNode.el.value = value;
            }
        } else {
            patchAttribute(
                prevNode,
                nextNode,
                prop,
                value
            )
        }
}

export function patchProps(prevNode, nextNode) {
    if (Object.isFrozen(nextNode.properties)) {
        throw Error("Properties of Next Node is frozen, likely re-used object.")
    }

    for (const prop in nextNode.properties) {
        const value = nextNode.properties[prop];

        if (value === null || value === undefined) continue;

        patchProp(prevNode, nextNode, prop, value)
    }

    if (prevNode) {
        for (const prop in prevNode.properties) {
            const nextProp = nextNode.properties[prop];

            if (nextProp !== null && nextProp !== undefined) continue;

            patchProp(prevNode, nextNode, prop, null)
        }
    }

    Object.freeze(nextNode.properties)
}