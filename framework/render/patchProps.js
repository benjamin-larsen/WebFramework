function patchClassName(prevNode, nextNode, classList) {
    let computedClass = classList;

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
    nextNode.attributes.set(attr, value)

    if (prevNode && prevNode.attributes.get(attr) === value) return;

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
    if (prevNode && prevNode.eventListeners.has(eventName)) {
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

export function patchElementProperties(prevNode, nextNode) {
    const patchedProps = new Set()
    for (const [prop, value] of Object.entries(nextNode.properties)) {
        if (value === null || value === undefined) continue;
        patchedProps.add(prop)

        if (prop.startsWith("on")) {
            patchEvent(
                prevNode,
                nextNode,
                prop.substring(2), // Event Name
                value // Listener Function
            )
        } else if (prop === "ref") {
            nextNode.refFn = value;
            
            if (prevNode && prevNode.refFn) {
                if (prevNode.refFn === value) continue;

                prevNode.refFn(null)
                value(nextNode.el)
            } else {
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
}