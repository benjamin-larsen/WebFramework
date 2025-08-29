import { reactive } from "../reactive.js"
import { c } from "../vnode.js"

export default {
    instanceSetup({ loadFunc }) {
        this.data.component = reactive({ value: null })

        loadFunc().then(module => {
            this.data.component.value = module.default
        })
    },
    render(props) {
        const childProps = { ...props }
        delete childProps.loadFunc;

        return [
            this.data.component.value ? c(this.data.component.value, childProps) : null
        ]
    }
}