import { ref } from '../reactivity/ref.js';
import { c } from '../vnode.js';

export default {
  methods: {
    loadFunction(ctx, func) {
      if (ctx.activeFunc) {
        ctx.activeFunc.cancelled = true;
        ctx.component.value = null;
      }

      const funcObj = { cancelled: false, func };

      ctx.activeFunc = funcObj;

      func().then((module) => {
        if (funcObj.cancelled) return;
        ctx.component.value = module.default;
      });
    }
  },

  onCreated(ctx, { loadFunc }) {
    ctx.component = ref(null);

    ctx.loadFunction(ctx, loadFunc);
  },

  beforeUpdate(ctx, { loadFunc }) {
    if (ctx.activeFunc.func === loadFunc) return;

    ctx.loadFunction(ctx, loadFunc);
  },

  onDestroy(ctx) {
    if (ctx.activeFunc) {
      ctx.activeFunc.cancelled = true;
    }
  },

  render(ctx, props) {
    const childProps = { ...props };
    delete childProps.loadFunc;
    delete childProps.fallback;

    return [
      this.component.value
        ? c(ctx.component.value, childProps)
        : props.fallback
          ? c(props.fallback, {})
          : null
    ];
  }
};
