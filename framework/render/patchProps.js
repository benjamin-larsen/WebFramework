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

function patchEvent(prevNode, nextNode, eventName, listenerFn) {
    nextNode.eventListeners.set(eventName, listenerFn)

    if (prevNode && prevNode.eventListeners.has(eventName)) {
        const oldEventListener = prevNode.eventListeners.get(eventName);
        if (oldEventListener === listenerFn) return;

        prevNode.el.removeEventListener(eventName, oldEventListener)
        nextNode.el.addEventListener(eventName, listenerFn)
    } else {
        nextNode.el.addEventListener(eventName, listenerFn)
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