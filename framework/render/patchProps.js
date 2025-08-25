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

    nextNode.attributes.set("class", computedClass)

    if (prevNode && prevNode.attributes.get("class") === computedClass) return;

    nextNode.el.className = computedClass
}

function patchAttribute(prevNode, nextNode, attr, value) {
    const hasPrevAttr = prevNode && prevNode.attributes.has(attr);

    if (value === null || value === undefined) {
        if (hasPrevAttr && prevNode.el) {
            prevNode.el.removeAttribute(attr)
        }

        return
    }

    nextNode.attributes.set(attr, value)

    if (hasPrevAttr && prevNode.attributes.get(attr) === value) return;

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

function patchEvent(prevNode, nextNode, eventName, listenerFn) {
    const hasPrevInvoker = prevNode && prevNode.eventListeners.has(eventName);

    if (typeof listenerFn !== 'function') {
        if (hasPrevInvoker && prevNode.el) {
            prevNode.el.removeEventListener(
                eventName,
                prevNode.eventListeners.get(eventName)
            )
        }

        return;
    }

    if (hasPrevInvoker) {
        const invoker = prevNode.eventListeners.get(eventName);
        nextNode.eventListeners.set(eventName, invoker)
        
        invoker.func = listenerFn;
        invoker.node = nextNode;
    } else {
        const invoker = createInvoker(listenerFn, nextNode);
        nextNode.eventListeners.set(eventName, invoker)

        nextNode.el.addEventListener(eventName, invoker)
    }
}

export function patchProp(prevNode, nextNode, prop, value) {
    if (prop.startsWith("on")) {
            patchEvent(
                prevNode,
                nextNode,
                prop.substring(2), // Event Name
                value // Listener Function
            )
        } else if (prop === "ref") {
            nextNode.refFn = value;
            
            if (prevNode && typeof prevNode.refFn === 'function') {
                if (prevNode.refFn === value) return;

                prevNode.refFn(null)
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
    for (const [prop, value] of Object.entries(nextNode.properties)) {
        if (value === null || value === undefined) continue;

        patchProp(prevNode, nextNode, prop, value)
    }

    if (prevNode) {
        for (const prop of Object.keys(prevNode.properties)) {
            const nextProp = nextNode.properties[prop];

            if (nextProp !== null && nextProp !== undefined) continue;

            patchProp(prevNode, nextNode, prop, null)
        }
    }
}