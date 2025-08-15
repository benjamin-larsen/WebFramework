class HeadContainer {
    constructor(attributes, children) {
        this.attributes = attributes;
        this.children = children;

        this.parent = null;
        this.node = document.head;
    }
}

export function head(attributes, ...children) {
    return new HeadContainer(attributes, children);
}

class BodyContainer {
    constructor(attributes, children) {
        this.attributes = attributes;
        this.children = children;

        this.parent = null;
        this.node = document.body;
    }
}

export function body(attributes, ...children) {
    return new BodyContainer(attributes, children);
}

class HTMLContainer {
    constructor(children) {
        this.parent = document;
        this.node = document.documentElement;

        for (const child of children) {
            if (child instanceof HeadContainer) {
                if (this.head) {
                    throw Error("Fatal Error: Multiple Head Tags")
                }

                this.head = child
                child.parent = this
            } else if (child instanceof BodyContainer) {
                if (this.body) {
                    throw Error("Fatal Error: Multiple Body Tags")
                }

                this.body = child
                child.parent = this
            } else {
                throw Error("Fatal Error: Invalid Tag")
            }
        }

        if (!this.head) {
            this.head = new HeadContainer({}, []);
        }

        if (!this.body) {
            this.body = new BodyContainer({}, []);
        }
    }
}

export function html(children) {
    return new HTMLContainer(children)
}

export class App {
    constructor(html) {
        this.html = html;
    }
}

export class Router {
    constructor() {

    }
}