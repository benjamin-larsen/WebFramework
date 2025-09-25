# Components
The Component is the fundemental building block of Noctes.jsx, at it's core a Component is a Object with a render() method, optional lifecycle hook methods and optional "methods" object with user-defined methods.
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
    [key: any]: (this: ComponentContext, ...args: any[]) => any
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

Props will be a immutable object, currently Root Components (children of class App) props will be undefined.

Render Functions must always return an array, wether empty or not. The array can contain VNode and null.
```ts
type RenderFunction = (
  this: ComponentContext,
  ctx: ComponentContext,
  props: Readonly<Object>,
  slots: Object
) => (VNode | null)[]
```

Example
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