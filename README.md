# How to get started?
The first thing you need to do is to create an App Instance by importing ("App") from ("framework/index.js"), in App's constructor you can specify various "App Roots" which currently are HeadContainer (created with head()) and BodyContainer (created with body()).

The App Roots take one paramter which is the render function.

After the App Instance is created, to start displaying your app, call .render()

## Example
```js
const app = new App(
    body(() => [
        v("div", "Hello World!"),
        v(parentComponent) // From Example of Render Function below
    ])
)

app.render()
```

# What is a render function?
The Render Function is the function that is executed by the Framework's Internal Render Engine, it expects an Array of VNodes. You may make thse VNodes with the v() function by importing it from ("framework/index.js"). The v() function takes up to 2 fixed paramters followed by it's children. The first paramter is the type, string being a Element, and Function being a Component, the 2nd paramater is the Properties Object (which is optional), all the following paramters are the Child VNodes of that VNode. Text Nodes are simply represented by strings.

## Example
```js
function childComponent(properties) {
    return [
        v(
            "div", // Element Node, Tag Name "div"
            { class: "container" }, // Properties
            v(
                "button",
                { style: "font-size: 16px" },
                "Text here ",
                v("span", { style: "font-size: 12px" }, "some smaller"),
                " and some bigger."
            )
        )
    ]
}

function parentComponent(properties) {
    return [
        v(
            childComponent // Component Node
        )
    ]
}
```