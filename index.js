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

function innerInnerComponent() {
    return [e("div", {}, t(someValue.value)), someBool2.value ? e("div", {}, t("Conditional from Component")) : null]
}

function innerComponent() {
    return [c(innerInnerComponent, {})]
}

function exampleComponent(props) {
    return [c(innerComponent, {}),
        e("div", {}, t("content after component"))]
}

window.someValue = someValue;
window.someBool = someBool;
window.someBool2 = someBool2

const app = new App(
    head(() => [
        e("title", {}, t("Web Framework test"))
    ]),
    body(() => [
        e("div", {}, t("Hi"), t(" hah")),
        c(exampleComponent, { }),
        someBool.value ? c(innerInnerComponent, {}) : e("div", {}, t("not component"))
    ])
)

app.render()
window.app = app

console.log(app)