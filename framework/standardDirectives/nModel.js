import { isRef } from '../reactive.js';

const inputListener = Symbol('inputListener');

export default {
  beforeMount(el, binding) {
    const invoker = function () {
      if (!isRef(invoker.model)) {
        console.warn('nModel must be provided with Ref, not value.');
        return;
      }

      invoker.model.value = invoker.el.value;
    };

    invoker.el = el;
    invoker.model = binding.value;

    el[inputListener] = invoker;

    el.addEventListener('input', invoker);
  },

  beforeUpdate(el, binding) {
    const invoker = el[inputListener];
    invoker.el = el;
    invoker.model = binding.value;
  },

  onReact(el, binding) {
    if (!isRef(binding.value)) {
      console.warn('nModel must be provided with Ref, not value.');
      return;
    }

    el.value = binding.value.value;
  },

  onDestroy(el) {
    el.removeEventListener('input', el[inputListener]);
    delete el[inputListener];
  }
};
