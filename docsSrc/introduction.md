::: warning
This documentation is for the Development Build 0.1.13, not for Alpha Build 0.1.0.
:::

# Introduction

Web Framework is a project of mine I've worked on since about August 18th, 2025. It went from bare boilerplate into a somewhat useful framework, including Components and Directives.

# Useful APIs

**new App()** <Badge type="tip" text="a9e9c83+" />

The arguments for the constructor is gonna be a variadic list of Root Nodes, Root Nodes are currently either HeadElement or BodyElement. There are functions body and head which can be imported that creates these Root Nodes.
```ts
declare class App {
  constructor(...children: RootNode[])
  /**
   * Prints a Basic Layout of the Virtual DOM Tree in console.
   */
  print()
  /**
   * Renders the application to the DOM.
   * IMPORTANT! Must only call once.  
   */
  render()
}
```

Example
```js
import { App, body, v } from 'webframework'

const app = new App(
  body(() => [
    v("div", "test")
  ])
)

app.render()
```

**Render Function** <Badge type="info" text="Conceptual" /> <Badge type="tip" text="4fda909+" />

This is a explanation / template of "Render Functions".

Props will be a immutable object, currently Root Components (children of class App) props will be undefined.

Render Functions must always return an array, wether empty or not. The array can contain VNode and null.
```ts
type RenderFunction = (this: ComponentInstance, props: Object) => (VNode | null)[]
```

Example
```js{4-8}
import { v } from 'webframework'

export default {
  render(props) { // [!code focus:5]
    return [
      v("div", `props.a is ${props.a}`)
    ]
  }
}
```

**Components** <Badge type="tip" text="98c2ab1+" />

Components are an object with various methods, for all these methods the "this" variable will be of their Component Instance. It is highly advised to not mess with properties of "this" except "this.data" which is a object that is controlled by the Component.
```ts
interface Component {
  render: RenderFunction;
  /**
   * Lifecycle hook that is called during the creation of ComponentInstance, and is the first ever hook to be called, even before first render.
   * This is where you should setup "this.data".
   */
  onCreated?: (this: ComponentInstance, props: Object) => void;
  /**
   * Lifecycle hook that is called when the Component has first been rendered.
   */
  onMounted?: (this: ComponentInstance, props: Object) => void;
  /**
   * Lifecycle hook that is called when the Component has been re-rendered.
   */
  onUpdated?: (this: ComponentInstance, props: Object) => void;
  /**
   * Lifecycle hook that is called after Component has been unmounted, and before Component Instance is destroyed.
   */
  onDestroy?: (this: ComponentInstance) => void;
}
```