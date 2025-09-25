# App
App is a class inside of Noctes.jsx. The arguments for the constructor is a variadic list of Root Containers.
```ts
declare class App {
  constructor(...children: RootContainer[])
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
import { App, body, v } from 'noctes.jsx'

const Component = {
  render() {
    return [
      v("div", "test")
    ]
  }
}

const app = new App(
  body(Component)
)

app.render()
```


# Root Container
Root Containers are a special VNode used in App class.
```ts
/**
 * Component is the component to be rendered onto Element.
 * Props will be passed as normal to the Component.
 */
declare class RootContainer {
  constructor(component: Component, element: HTMLElement, props: Object)
}
```

Root Containers can be created with the root(), body() and head() functions.
```ts
/**
 * query is used inside document.querySelector to get element.
 */
function root(component: Component, query: string, props?: Object): RootContainer

/**
 * This is the most raw version of making RootContainer.
 */
function root(component: Component, element: HTMLElement, props?: Object): RootContainer

/**
 * This will set element to document.head
 */
function head(component: Component, props?: Object): RootContainer

/**
 * This will set element to document.body
 */
function body(component: Component, props?: Object): RootContainer
```