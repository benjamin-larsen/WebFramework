import { ComponentInstance, isComponent } from './component.js';
import { REACTIVE_FLAGS, EMPTY_PROPS } from './constants.js';
import standardComponents from './standardComponents/index.js';
import { isRef } from './reactivity/ref.js';
import { destroyDirective } from './render/directives.js';

export class RootContainer {
  constructor(component, el, props) {
    if (!isComponent(component))
      throw Error('Provided Root Component is not a Component.');

    this.component = component;
    this.properties = props;
    this.children = [];
    this.keyMap = new Map();

    this.el = el;

    this.instance = new ComponentInstance(this, 0, null);
  }
}

export function root(component, queryOrElement, props) {
  let element = queryOrElement;

  if (typeof queryOrElement === 'string') {
    element = document.querySelector(queryOrElement);
  }

  if (!(element instanceof HTMLElement)) throw Error('Invalid Root Element');

  return new RootContainer(component, element, props || EMPTY_PROPS);
}

export function head(component, props) {
  return new RootContainer(component, document.head, props || EMPTY_PROPS);
}

export function body(component, props) {
  return new RootContainer(component, document.body, props || EMPTY_PROPS);
}

export class FragmentNode {
  constructor() {
    this.children = [];
    this.keyMap = new Map();

    this.index = null;
    this.parent = null;
    this.anchor = null;
    this.el = null;
  }

  unmount(DOMHandled = false) {
    this.anchor = null;

    for (const child of this.children) {
      if (!child) continue;
      child.unmount(DOMHandled, false);
    }

    // Prevent Memory Leak
    this.parent = null;
    this.children = null;
  }

  move(parentNode, anchor) {
    for (const child of this.children) {
      if (!child) continue;

      child.move(parentNode, anchor);
    }
  }
}

export class ElementNode {
  constructor(tag, properties, children) {
    this.tag = tag;
    this.properties = properties || EMPTY_PROPS;
    this.children = children;
    this.keyMap = new Map();

    this.el = null;
  }

  unmount(DOMHandled = false, isRoot = false) {
    // if not isRoot it means a parent Element was unmounted.
    if (this.transition && isRoot) {
      this.transition.onLeave(this.el, this);
      return;
    }

    for (const child of this.children) {
      if (!child) continue;
      child.unmount(true, false);
    }

    if (isRef(this.properties.ref)) {
      this.properties.ref.value = null;
    }

    if (this.dirs && this.dirs.constructor === Map) {
      for (const [directive, binding] of this.dirs) {
        destroyDirective(directive, binding, this);
      }
    }

    if (this.el && !DOMHandled) {
      this.el.remove();
    }

    this.el = null;
    this.children = null;
  }

  move(parentNode, anchor) {
    parentNode.el.insertBefore(this.el, anchor);
  }
}

// Create Element Virtual Node
export function createElement(tag, attributes, ...children) {
  return new ElementNode(tag, attributes, children);
}

export const e = createElement;

export class TextNode {
  constructor(text) {
    this.text = text;

    this.el = null;
  }

  unmount(DOMHandled = false) {
    if (!this.el) return;

    if (!DOMHandled) {
      this.el.remove();
    }

    this.el = null;
  }

  move(parentNode, anchor) {
    parentNode.el.insertBefore(this.el, anchor);
  }
}

export class ComponentNode {
  constructor(component, properties, slots) {
    if (!isComponent(component))
      throw Error('Provided Component is not a Component.');

    if (
      component[REACTIVE_FLAGS.IS_REACTIVE] ||
      component[REACTIVE_FLAGS.IS_READONLY]
    ) {
      this.component = component[REACTIVE_FLAGS.UNWRAP];
    } else {
      this.component = component;
    }

    if (import.meta.hot) {
      const mappedComponent = window.HMR.componentMap.get(
        this.component._hmrid
      );

      if (mappedComponent) {
        this.component = mappedComponent;
      }
    }

    this.properties = properties ? properties : EMPTY_PROPS;

    if (Array.isArray(this.dirs)) {
      console.warn(
        'Directive(s) were defined in a ComponentNode, but directives are not supported for Components.'
      );
    }

    if (slots) {
      this.slots = slots;
    }

    this.children = [];
    this.keyMap = new Map();
    this.parent = null;

    this.index = null;
    this.anchor = null;
    this.el = null;
    this.instance = null;
  }

  unmount(DOMHandled = false, isRoot = false) {
    this.instance.callHook('beforeDestroy');

    this.anchor = null;

    for (const child of this.children) {
      if (!child) continue;
      child.unmount(DOMHandled, this.transition && isRoot);
    }

    // Prevent Memory Leak
    this.parent = null;
    this.children = null;

    // Call unmount hook before instance is destroyed.
    this.instance.callHook('onDestroy');

    this.instance.destroy();
    this.instance = null;
  }

  move(parentNode, anchor) {
    for (const child of this.children) {
      if (!child) continue;
      child.move(parentNode, anchor);
    }
  }
}

// Create Component Virtual Node
export function createComponent(component, properties, slots) {
  if (typeof component === 'string' && standardComponents[component]) {
    return new ComponentNode(standardComponents[component], properties, slots);
  }

  return new ComponentNode(component, properties, slots);
}

export const c = createComponent;

// Create Virtual Node (inferred)
// Element: v(tag, attributes?, text?, ...children)
// Component: v(component, properties?)
export function createVNode(type, ...data) {
  switch (typeof type) {
    case 'string': {
      if (standardComponents[type]) {
        return new ComponentNode(
          standardComponents[type],
          data[0] || {},
          data[1]
        );
      }

      let properties = {};

      if (
        data[0] !== null &&
        typeof data[0] === 'object' &&
        data[0].constructor === Object
      ) {
        properties = data[0];
        data = data.slice(1);
      }

      return new ElementNode(type, properties, data);
    }

    case 'object': {
      if (type === null) return null;

      return new ComponentNode(type, data[0] || {}, data[1]);
    }

    default: {
      return null;
    }
  }
}

export const v = createVNode;

export function withDirectives(vnode, dirs) {
  vnode.dirs = dirs;

  return vnode;
}

export const containerNodes = [
  RootContainer,
  FragmentNode,
  ElementNode,
  ComponentNode
];
