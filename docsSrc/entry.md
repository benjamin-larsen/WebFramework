# Entrypoint
In the Entrypoint is where you should declare the Root Components and where all plugins should be used, and anything else nesscary to run before the rendering of the website.


# Example
```js
import './style.css'
import { App, head, body } from "noctes.jsx"
import HeadRoot from './roots/Head.jsx'
import BodyRoot from './roots/Body.jsx'

const app = new App(
    head(HeadRoot),
    body(BodyRoot)
)

app.render()
```