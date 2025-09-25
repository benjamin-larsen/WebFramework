# JSX
A JSX file defines a Noctes.jsx Component, it should export default a object with a render() function and lifecycle hooks (refer to [API](/api-component.html#components)).

To declare string expressions use ${}, to declare children expressions use {}, return null to declare Empty Slot.

Render functions takes in three paramaters:
<br>
**ctx** - Component Context, here you can get and set data and get methods.
<br>
**props** - A readonly object of Component Properties.
<br>
**slots** - A object of component slots, please refer to [API](/api-component.html#render-slots) for more information.

# Example
```jsx
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