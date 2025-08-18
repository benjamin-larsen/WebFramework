import {
    App,
    head,
    body,
    reactive,
    e, t, c
} from './framework.js'

function exampleComponent(props) {
    return e("div", {}, t(props.test))
}

const someValue = reactive({ value: "hi" })
const someBool = reactive({ value: false })

const app = new App(
    head(() => [
        e("title", {}, t("Web Framework test"))
    ]),
    body(() => [
        e("div", {}, t("Hi")),
        c(exampleComponent, { test: someValue.value }),
        someBool.value ? e("div", {}, t("Conditional Content")) : null
    ])
)

app.render()

console.log(app)