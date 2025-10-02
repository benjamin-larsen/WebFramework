import { RESERVED_PROPS, NAMESPACES } from '../constants.js';
import { isRef } from '../reactive.js';

function patchClassName(prevNode, nextNode, classList) {
  let computedClass = classList || '';

  if (classList === null || classList === undefined) {
    if (prevNode.properties.class && prevNode.el) {
      prevNode.el.removeAttribute('class');
    }

    return;
  }

  if (Array.isArray(classList)) {
    computedClass = classList.join(' ');
  } else if (typeof classList === 'object') {
    let classArray = [];

    for (const name in classList) {
      if (classList[name]) classArray.push(name);
    }

    computedClass = classArray.join(' ');
  }

  nextNode.properties.class = computedClass;

  if (prevNode && prevNode.properties.class === computedClass) return;

  nextNode.el.className = computedClass;
}

// Code from Vue (@vue/shared)
const hyphenateRE = /\B([A-Z])/g;

function hyphenate(str) {
  if (str.slice(0, 2) === '--') return str;
  return str.replace(hyphenateRE, '-$1').toLowerCase();
}

function patchStyles(prevNode, nextNode, rawStyles) {
  let computedStyle = rawStyles || '';

  if (rawStyles === null || rawStyles === undefined) {
    if (prevNode.properties.style && prevNode.el) {
      prevNode.el.removeAttribute('style');
    }

    return;
  }

  if (typeof rawStyles === 'object') {
    let styleArray = [];

    for (const style in rawStyles) {
      if (!rawStyles[style]) continue;
      styleArray.push(`${hyphenate(style)}: ${rawStyles[style]}`);
    }

    computedStyle = styleArray.join(';');
  }

  nextNode.properties.style = computedStyle;

  if (prevNode && prevNode.properties.style === computedStyle) return;

  nextNode.el.style.cssText = computedStyle;
}

function resolveAttributeName(attrName) {
  if (attrName === 'xmlns') return NAMESPACES.xmlns;

  const parts = attrName.split(':');

  if (parts.length > 1 && NAMESPACES[parts[0]]) {
    return NAMESPACES[parts[0]];
  }

  return null;
}

function patchAttribute(prevNode, nextNode, attr, value) {
  const attrNamespace = resolveAttributeName(attr);

  const hasPrevAttr = prevNode && prevNode.properties[attr];

  if (value === null || value === undefined) {
    if (hasPrevAttr && prevNode.el) {
      if (attrNamespace) {
        prevNode.el.removeAttributeNS(attrNamespace, attr);
      } else {
        prevNode.el.removeAttribute(attr);
      }
    }

    return;
  }

  if (hasPrevAttr && prevNode.properties[attr] === value) return;

  if (attrNamespace) {
    nextNode.el.setAttributeNS(attrNamespace, attr, value);
  } else {
    nextNode.el.setAttribute(attr, value);
  }
}

function createInvoker(func, node) {
  function invoker(...args) {
    if (!invoker.func) return;
    invoker.func.apply(invoker.node, args);
  }

  invoker.node = node;
  invoker.func = func;

  return invoker;
}

function patchEvent(prevNode, nextNode, propName, listenerFn) {
  const eventName = propName[2].toLowerCase() + propName.substring(3);
  const hasPrevInvoker =
    prevNode && prevNode.eventInvokers && prevNode.eventInvokers[eventName];

  if (typeof listenerFn !== 'function') {
    if (hasPrevInvoker && prevNode.el) {
      prevNode.el.removeEventListener(
        eventName,
        prevNode.eventInvokers[eventName]
      );
      delete prevNode.eventInvokers[eventName];
    }

    return;
  }

  const invokerMap = nextNode.eventInvokers || (nextNode.eventInvokers = {});

  if (hasPrevInvoker) {
    const invoker = prevNode.eventInvokers[eventName];
    invokerMap[eventName] = invoker;

    invoker.func = listenerFn;
    invoker.node = nextNode;
  } else {
    const invoker = createInvoker(listenerFn, nextNode);
    invokerMap[eventName] = invoker;

    nextNode.el.addEventListener(eventName, invoker);
  }
}

function isEvent(propName) {
  if (propName.length < 3) return false;
  if (propName[0] !== 'o') return false;
  if (propName[1] !== 'n') return false;
  if (propName.charCodeAt(2) < 65) return false;
  if (propName.charCodeAt(2) > 90) return false;

  return true;
}

export function patchProp(prevNode, nextNode, prop, value, namespace) {
  if (RESERVED_PROPS.has(prop)) return;

  if (isEvent(prop)) {
    patchEvent(
      prevNode,
      nextNode,
      prop, // Prop Name
      value // Listener Function
    );
  } else if (prop === 'ref') {
    if (prevNode && isRef(prevNode.properties.ref)) {
      if (prevNode.properties.ref === value) return;

      prevNode.properties.ref.value = null;
    }

    if (isRef(value)) {
      value.value = nextNode.el;
    }
  } else if (prop === 'class' && namespace !== NAMESPACES.svg) {
    patchClassName(prevNode, nextNode, value);
  } else if (prop === 'style') {
    patchStyles(prevNode, nextNode, value);
  } else {
    patchAttribute(prevNode, nextNode, prop, value);
  }
}

export function patchProps(prevNode, nextNode, namespace) {
  if (prevNode && prevNode.properties === nextNode.properties) return;

  for (const prop in nextNode.properties) {
    const value = nextNode.properties[prop];

    if (value === null || value === undefined) continue;

    patchProp(prevNode, nextNode, prop, value, namespace);
  }

  if (prevNode) {
    for (const prop in prevNode.properties) {
      const nextProp = nextNode.properties[prop];

      if (nextProp !== null && nextProp !== undefined) continue;

      patchProp(prevNode, nextNode, prop, null, namespace);
    }
  }
}
