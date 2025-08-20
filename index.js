import {
    App,
    head,
    body,
    reactive,
    e, t, c, v
} from './framework.js'

const someValue = reactive({ value: "hi" })
const someBool = reactive({ value: false })
const someBool2 = reactive({ value: false })
const title = reactive({ value: "Web Framework test" })

/*function newComponent() {
    return [e("div", {}, t("new comp"))]
}

function innerInnerComponent() {
    return [e("div", {}, t(someValue.value)), someBool2.value ? e("div", {}, t("Conditional from Component")) : null]
}

function innerComponent() {
    return [c(innerInnerComponent, {})]
}

function exampleComponent(props) {
    return [c(innerComponent, {}),
        e("div", {}, t("content after component"))]
}*/

function newComponent() {
    return [
        v("div", "new comp")
    ]
}

function innerInnerComponent() {
    return [
        v("div", someValue.value),
        v(someBool2.value ? "div" : null, "Conditional from Component")
    ]
}

function innerComponent() {
    return [
        v(innerInnerComponent)
    ]
}

function exampleComponent(props) {
    return [
        v(innerComponent),
        v("div", "content after component")
    ]
}

window.someValue = someValue;
window.someBool = someBool;
window.someBool2 = someBool2
window.title = title

/*const app = new App(
    head(() => [
        e("title", {}, t(title.value))
    ]),
    body(() => [
        e("div", {}, t("Hi"), t(" hah")),
        c(exampleComponent, { }),
        someBool.value ? c(innerInnerComponent, {}) : c(newComponent, {}),
        e("div", {}, t("Hi"))
    ])
)*/
const app = new App(
    head(() => [
        v("title", title.value)
    ]),
    body(() => [
        v("div", "Hi", " hah"),
        v(exampleComponent),
        v(someBool.value ? innerInnerComponent : newComponent),
        v("div", "Hi")
    ])
)

app.render()
window.app = app

console.log(app)