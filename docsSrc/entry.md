# Entrypoint
In the Entrypoint is where you should declare the Root Components and where all plugins should be used, and anything else nesscary to run before the rendering of the website.


**Example**
```js
import './style.css'
import { App, body } from "noctes.jsx"
import AppComponent from './App.jsx'

const app = new App(
  body(AppComponent, { msg: "World" })
)

app.render()
```