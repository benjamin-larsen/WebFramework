---
outline: deep
---

# Components
The Component is the fundemental building block of Noctes.jsx, at its core a Component is a Object with a render() method, optional lifecycle hook methods and optional "methods" object with user-defined methods.
```ts
interface Component {
  render: RenderFunction;

  /**
   * Lifecycle hook that is called when an error occured during rendering.
   */
  onError?: (
    this: ComponentContext,
    ctx: ComponentContext,
    err: Error
  ) => void;

  /**
   * Lifecycle hook that is called during the creation of
     ComponentContext, and is the first ever hook to be called,
     even before first render.
   * This is where you should setup data in ctx or "this"
   */
  onCreated?: (
    this: ComponentContext,
    ctx: ComponentContext,
    props: Readonly<Object>
  ) => void;

  /**
   * Lifecycle hook that is called when the Component has first been rendered.
   */
  onMounted?: (
    this: ComponentContext,
    ctx: ComponentContext,
    props: Readonly<Object>
  ) => void;

  /**
   * Lifecycle hook that is called before Component re-renders.
   */
  beforeUpdate?: (
    this: ComponentContext,
    ctx: ComponentContext,
    props: Readonly<Object>
  ) => void;

  /**
   * Lifecycle hook that is called when the Component has been re-rendered.
   */
  onUpdated?: (
    this: ComponentContext,
    ctx: ComponentContext,
    props: Readonly<Object>
  ) => void;

  /**
   * Lifecycle hook that is called after Component has been unmounted,
     and before Component Instance is destroyed.
   */
  onDestroy?: (this: ComponentContext, ctx: ComponentContext) => void;

  methods?: {
    [key: string]: (this: ComponentContext, ...args: any[]) => any
  }
}
```

## **Shared Properties**

## **Render Slots**

## **Component Context**
Component Context is a proxied Component Instance, that is provided to Lifecycle Hooks, Methods and Render Function.

Component Instance are created when the first VNode for a specific component at same position appears, and is destroyed when the VNode of same component and same position is no longer found.

Component Instance carries information like Effects (reactive subscriptions), Component Data (data used by Component) and properties.
```ts
declare class ComponentContext {}
```

## **Render Function**

This is a explanation / template of "Render Functions".

Props must not be changed, and must be immutable.

Render Functions must always return an array, wether empty or not. The array can contain VNode and null.
```ts
type RenderFunction = (
  this: ComponentContext,
  ctx: ComponentContext,
  props: Readonly<Object>,
  slots: ComponentSlots
) => Fragment
```

**Example**
```js{4-8}
import { v } from 'noctes.jsx'

export default {
  render(ctx, props) { // [!code focus:5]
    return [
      v("div", `props.a is ${props.a}`)
    ]
  }
}
```

### **Empty Slots**

Empty slots are null values inside of Fragments, used to tell Noctes.jsx that there is a VNode reserved to be in that position, that way when that VNode is mounted (for example a condition is furfilled), Noctes.jsx doesn't have to move and unmount alot of things unnecessarily.
```ts
/**
 * Empty Slots are just the value ("null").
 */
type EmptySlot = null;
```

### **Fragment**

A fragment is an array of VNode and Empty Slots (null) used in VNode children or returned by render functions, fragments can also be inside of other fragments.

When rendering lists alongside other elements in one Container Element, you should wrap the list in a Fragment.
```ts
/**
 * Fragments are an array of either VNode, other Fragments or Empty Slots.
 * 
 * Used by Render Function, VNode Children and nested fragments
   (technically speaking, all Fragments except Root Component
   are nested fragments).
 */
type Fragment = (VNode | Fragment | EmptySlot)[];
```

### **VNode**

VNodes in render functions are either of type Element Node, Component Node, string (converted to Text Node by Noctes.jsx) or array (converted to Fragment Node by Noctes.jsx).

Properties must be immutable, new properties shall be passed with a new object.

You can make Element or Component VNodes with the following functions:
```ts
/* Alias: e() */
function createElement(
  tag: string,
  properties: Readonly<Object> | null,
  ...children: Fragment
): ElementNode

/* Alias: c() */
/**
 * component would only ever be string if the first character is uppercase, and is one of the Standard Components such as ("Lazy").
 */
function createComponent(
  component: Component | string,
  properties: Readonly<Object> | null,
  slots?: ComponentSlots
): ComponentNode

/* Alias: v() */
/**
 * component can only be passed as string if it's part of Standard Components such as ("Lazy"), if it's not it will be interpeted as a tag for Element Node.
 */
function createVNode(
  component: Component | string,
  properties: Readonly<Object> | null,
  slots?: ComponentSlots
): ComponentNode

/**
 * If the 2nd argument is not a direct Object (constructor is Object) it will interpit it as no properties and set children as rest of arguments.
 */
function createVNode(
  tag: string,
  ...children: Fragment
): ElementNode

function createVNode(
  tag: string,
  properties: Readonly<Object>,
  ...children: Fragment
): ElementNode
```