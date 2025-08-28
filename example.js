import {
    App,
    head,
    body,
    reactive,
    e, t, c, v
} from './framework/index.js'

const someValue = reactive({ value: "hi" })
const boolObj = { value: false }
const someBool = reactive(boolObj)
const someBool2 = reactive({ value: false })
const isRunning = reactive({ value: false })
const title = reactive({ value: "Web Framework test" })

window.isRunning = isRunning;

const start = Date.now()

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

const newComponent = {
    render(props) {
        return [
            v("div", "new comp")
        ]
    }
}

const innerInnerComponent = {
    render(props) {
        return [
            v("div", someValue.value),
            v(someBool2.value ? "div" : null, "Conditional from Component")
        ]
    }
}

const innerComponent = {
    render(props) {
        return [
            v(innerInnerComponent)
        ]
    }
}

const exampleComponent = {
    render(props) {
        if (boolObj.value == false) {
            someBool.value = true
        }

        if (isRunning.value) {
            //this.$forceUpdate()
            //requestAnimationFrame(this.$forceUpdate.bind(this))
        }

        const arr = [
            v("div", {}, v(innerInnerComponent))
        ]

        console.log(arr)

        return arr;
    }
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

const HeadRoot = {
    render() {
        return [
            v("title", title.value)
        ]
    }
}

const BodyRoot = {
    render() {
        return [
            v("div", { onclick: function () { alert('test')}, class: ["test", "test2"] }, "Hi", " hah"),
            v(exampleComponent),
            //v(someBool.value ? innerInnerComponent : newComponent),
            v("div", "Hi")
            /*v(() => [

            ])*/
        ]
    }
}

const app = new App(
    head(HeadRoot),
    body(BodyRoot)
)

app.render()
window.app = app

console.log(app)