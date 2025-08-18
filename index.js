import {
    App,
    head,
    body,
    reactive,
    e, t, c
} from './framework.js'

const someValue = reactive({ value: "hi" })
const someBool = reactive({ value: false })
const someBool2 = reactive({ value: false })

function exampleComponent(props) {
    return [e("div", {}, t(props.test)), someBool2.value ? e("div", {}, t("Conditional from Component")) : null, e("div", {}, t("Hey div from Component"))]
}

window.someValue = someValue;
window.someBool = someBool;
window.someBool2 = someBool2

const app = new App(
    head(() => [
        e("title", {}, t("Web Framework test"))
    ]),
    body(() => [
        e("div", {}, t("Hi")),
        someBool.value ? e("div", {}, t("Conditional Content")) : null,
        c(exampleComponent, { test: someValue.value })
    ])
)

app.render()

console.log(app)