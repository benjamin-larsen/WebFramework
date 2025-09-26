# Example App
Here is a little example app within src of Vite App.

::: code-group

```js [main.js]
import './style.css'
import { App, body } from "noctes.jsx"
import AppComponent from './App.jsx'

const app = new App(
  body(AppComponent, { msg: "World" })
)

app.render()
```

```jsx [App.jsx]
import { ref } from 'noctes.jsx'

export default {
  methods: {
    toggleSecret(e) {
      this.showSecret.value = !this.showSecret.value
    }
  },

  onCreated(ctx) {
    ctx.showSecret = ref(false)
  },

  render(ctx, props) {
    return (<>
      <div>Hello: ${props.msg}</div>
      <button onClick={ctx.toggleSecret}>
        ${ ctx.showSecret.value ? 'Hide' : 'Show' } Secret
      </button>
      { ctx.showSecret.value ? <div>Secret Message! Shh!</div> : null }
    </>)
  }
}
```

```css [styles.css]
:root {
  font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  height: 100vh;
  width: 100vw;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }

  button {
    background-color: #f9f9f9;
  }
}
```

:::