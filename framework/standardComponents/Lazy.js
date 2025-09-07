import { ref } from "../reactive.js"
import { c } from "../vnode.js"

export default {
    methods: {
        loadFunction(func) {
            if (this.activeFunc) {
                this.activeFunc.cancelled = true
                this.component.value = null
            }

            const funcObj = {
                cancelled: false,
                func
            }

            this.activeFunc = funcObj

            func().then(module => {
                if (funcObj.cancelled) return;
                this.component.value = module.default
            })
        }
    },

    onCreated({ loadFunc }) {
        this.component = ref(null)
        
        this.loadFunction(loadFunc)
    },

    onUpdated({ loadFunc }) {
        if (this.activeFunc.func === loadFunc) return;

        this.loadFunction(loadFunc)
    },

    render(props) {
        const childProps = { ...props }
        delete childProps.loadFunc;
        delete childProps.fallback;

        return [
            this.component.value ? c(this.component.value, childProps) : props.fallback ? c(props.fallback, {}) : null
        ]
    }
}