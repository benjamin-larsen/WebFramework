---
outline: deep
---

# Directives
::: info
Because JSX doesn't natively understand the concept of Directives, syntax highlighters and other JSX tools (except the Noctes JSX Compiler) will interpit `n{Directive}` as simply another attribute, and will therefore incorrectly consider the `n{Directive}` decleration / import unused.
:::

Directives are a special attribute prefixed with the letter `n` and written in camel case (ex. nDirective) that can be used on Elements. These attributes corresponds with a object of Hooks that are scripts that are ran during various lifecycles of the Element (like on creation, on updates and when element is removed).
```ts
interface Directive {
  /**
   * onReact is a special Directive Hook used for Reactive Directives.
   * This Directive Hook is tracked, unlike the other hooks.
   * This runs before onMounted/onUpdated hook, or when one of its dependeices are updated
   */
  onReact?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    node: VNode
  ) => void;

  /**
   * Called once the Directive is first attached to the Element.
   * Runs before the Element's attributes and children are synced. (i.e. the attributes and/or children may be empty or outdated)
   */
  beforeMount?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    node: VNode
  ) => void;

  /**
   * Called after the Directive is first attached to the Element.
   * Runs after the Element's attributes and children are synced.
   */
  onMounted?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    node: VNode
  ) => void;

  /**
   * Called before Element's attribute and children are synced (excepting first attachment, where beforeMount is called).
   */
  beforeUpdate?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    node: VNode,
    prevNode: VNode
  ) => void;

  /**
   * Called after Element's attribute and children are synced (excepting first attachment, where onMounted is called).
   */
  onUpdated?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    node: VNode,
    prevNode: VNode
  ) => void;

  /**
   * This Directive Hook runs when the Directive or Element gets removed.
   */
  onDestroy?: (
    el: HTMLElement,
    binding: DirectiveBinding,
    prevNode: VNode
  ) => void;
}
```

**Example**
```jsx
const nTest = {
  onMounted(el) {
    el.classList.add('testDirective')
  }

  onDestroy(el) {
    el.classList.remove('testDirective')
  }
}

export default {
  render(ctx, props, slots) {
    return (
    <>
    <div nTest>Hello</div>
    </>
    )
  }
}
```

## Directive Binding
::: warning
All the variables except `value` and `oldValue` are inteded for Internal Use.

Do not modify any value in directive binding.
:::
```ts
enum DirectiveState {
  /**
   * Directive has been synchronized.
   */
  SYNCED = 0,
  /**
   * Directive has been synchronized and has been newly attached/mounted.
   */
  SYNCED_MOUNT = 1,
  /**
   * Directive is unsynchronized.
   * Used for clean-up to find detached/destroyed Directives.
   */
  UNSYNCED = 2,
}

interface DirectiveBinding {
  /**
   * The Directive of the binding.
   * 
   * WARNING: Meant for Internal Use, do
   */
  dir: Directive;

  /**
   * The Value of the Directive Binding.
   * Used to input data to Directive hooks.
   */
  value: any | null;

  /**
   * The Previous Value of the Directive Binding.
   * Used for getting previous value in Directive Hooks.
   */
  oldValue?: any | null;

  /**
   * ReactiveDirective is a internal class used for managing Reactive State of the Directive.
   * Only present if onReact hook is present.
   */
  react?: ReactiveDirective;

  /**
   * Internal State of Directive.
   * Used for determining if Directive is newly attached, etc.
   */
  status: DirectiveState;
}
```

## VNode Helper
VNode Helper is a function that assigns "dirs" property on a VNode and returns the VNode back, this is useful for adding directives to a VNode without having to assign VNode to a tempoary variable.
```ts
function withDirectives(
  node: VNode,
  /**
   * only specify the dir and value of the binding.
   */
  dirs: DirectiveBinding[]
): VNode
```

## Standard / Built-in Directives
### nModel
nModel is a build-in directive provided by Noctes.jsx, it can be used by any HTML Element that has the DOM property "value".

You set value as a ref() which will be the model, the model value and "value" DOM property is synced. This is useful for accepting inputs.

Currently only likely to work with `<input>` but planned to work with more Element types soon.

**Example**
```jsx
import { nModel, ref } from 'noctes.jsx'

export default {
  methods: {
    submit(e) {
      alert(`You typed: ${this.input.value}`)

      this.input.value = ""
    }
  },

  onCreated(ctx, props) {
    ctx.input = ref("")
  },

  render(ctx, props, slots) {
    return (
    <>
    <input nModel={ctx.input} />
    <button onClick={ctx.methods.submit}>Submit</button>
    </>
    )
  }
}
```

**Example with Raw Render Functions**
```js
import { nModel, ref, e, withDirectives } from 'noctes.jsx'

export default {
  methods: {
    submit(e) {
      alert(`You typed: ${this.input.value}`)

      this.input.value = ""
    }
  },

  onCreated(ctx, props) {
    ctx.input = ref("")
  },

  render(ctx, props, slots) {
    return [
      withDirectives(
        e("input", null),
        [{ dir: nModel, value: ctx.input }]
      ),
      e("button", { onClick: ctx.methods.submit }, "Submit")
    ]
  }
}
```