import { TRANSITION_CLASS } from '../constants.js';
import { ComponentNode, ElementNode } from '../vnode.js';

function getInnerChild(child) {
  if (!child) return [];

  if (Array.isArray(child)) return child;

  return [child];
}

function addTransitionClass(el, className) {
  el[TRANSITION_CLASS].add(className);
  el.classList.add(className);
}

function removeTransitionClass(el, className) {
  el[TRANSITION_CLASS].delete(className);
  el.classList.remove(className);
}

function clearTransitionClass(el) {
  if (!el[TRANSITION_CLASS]) return;

  for (const className of el[TRANSITION_CLASS]) {
    el.classList.remove(className);
  }

  el[TRANSITION_CLASS].clear();
}

export function setNodeTransition(children, transition) {
  if (children.length === 0) return;

  if (
    children.length > 1 ||
    typeof children[0] !== 'object' ||
    (children[0].constructor !== ElementNode &&
      children[0].constructor !== ComponentNode)
  ) {
    console.warn('<transition> expects a single Component or Element.');
  } else {
    if (children[0].transition) return;
    children[0].transition = transition;
  }
}

function useTransitionTracker(el) {
  const obj = { hasTransition: false, hasAnimation: false, cancelled: false };

  const transitionEvent = () => {
    el.removeEventListener('transitionstart', transitionEvent);
    if (obj.cancelled) return;
    obj.hasTransition = true;
  };

  const animationEvent = () => {
    el.removeEventListener('animationstart', animationEvent);
    if (obj.cancelled) return;
    obj.hasAnimation = true;
  };

  el.addEventListener('transitionstart', transitionEvent, { once: true });
  el.addEventListener('animationstart', animationEvent, { once: true });

  obj.cancel = () => {
    obj.cancelled = true;

    if (!obj.hasTransition) {
      el.removeEventListener('transitionstart', transitionEvent);
    }

    if (!obj.hasAnimation) {
      el.removeEventListener('animationstart', animationEvent);
    }
  };

  return obj;
}

export default {
  onCreated(ctx) {
    ctx.pendingRemove = null;
    ctx.hasMounted = false;

    ctx.hooks = {
      beforeEnter() {
        if (ctx.pendingRemove) {
          ctx.pendingRemove();
        }
      },

      onEnter(el) {
        if (!ctx.hasMounted) return;

        el._isEntering = true;

        if (!el[TRANSITION_CLASS]) {
          el[TRANSITION_CLASS] = new Set();
        }

        const transitionTracker = useTransitionTracker(el);

        addTransitionClass(el, 'transition-enter-from');
        addTransitionClass(el, 'transition-enter-active');

        const enter = (e) => {
          if (typeof e === 'object') {
            if (e.type === 'transitionend') {
              transitionTracker.hasTransition = false;
            } else if (e.type === 'animationend') {
              transitionTracker.hasAnimation = false;
            }

            el.removeEventListener(e.type, enter);

            if (
              transitionTracker.hasTransition ||
              transitionTracker.hasAnimation
            )
              return false;
          }

          if (!el._isEntering) return;

          el._isEntering = false;

          clearTransitionClass(el);
        };

        requestAnimationFrame(() => {
          if (!el._isEntering) return;

          el.addEventListener('animationend', enter, { once: true });
          el.addEventListener('transitionend', enter, { once: true });

          removeTransitionClass(el, 'transition-enter-from');
          addTransitionClass(el, 'transition-enter-to');

          requestAnimationFrame(() => {
            transitionTracker.cancel();
            const { hasTransition, hasAnimation } = transitionTracker;

            if (!hasAnimation) {
              el.removeEventListener('animationend', enter);
            }

            if (!hasTransition) {
              el.removeEventListener('transitionend', enter);
            }

            if (!hasAnimation && !hasTransition) {
              enter();
            }
          });
        });
      },

      onLeave(el, vnode) {
        if (ctx.pendingRemove) {
          ctx.pendingRemove();
        }

        el._isEntering = false;
        el._isLeaving = true;

        const transitionTracker = useTransitionTracker(el);

        clearTransitionClass(el);

        // Dont need to use addTransitionClass, as element has left the vDOM.
        el.classList.add('transition-leave-from');
        el.classList.add('transition-leave-active');

        const leave = (e) => {
          if (typeof e === 'object') {
            if (e.type === 'transitionend') {
              transitionTracker.hasTransition = false;
            } else if (e.type === 'animationend') {
              transitionTracker.hasAnimation = false;
            }

            el.removeEventListener(e.type, leave);

            if (
              transitionTracker.hasTransition ||
              transitionTracker.hasAnimation
            )
              return false;
          }

          if (!el._isLeaving) return;

          ctx.pendingRemove = null;
          el._isLeaving = false;
          vnode.unmount(false, false);
        };

        ctx.pendingRemove = leave;

        requestAnimationFrame(() => {
          if (!el._isLeaving) return;

          el.addEventListener('animationend', leave, { once: true });
          el.addEventListener('transitionend', leave, { once: true });

          el.classList.remove('transition-leave-from');
          el.classList.add('transition-leave-to');

          requestAnimationFrame(() => {
            transitionTracker.cancel();
            const { hasTransition, hasAnimation } = transitionTracker;

            if (!hasAnimation) {
              el.removeEventListener('animationend', leave);
            }

            if (!hasTransition) {
              el.removeEventListener('transitionend', leave);
            }

            if (!hasAnimation && !hasTransition) {
              leave();
            }
          });
        });
      }
    };
  },

  onMounted(ctx) {
    ctx.hasMounted = true;
  },

  onDestroy(ctx) {
    if (ctx.pendingRemove) {
      ctx.pendingRemove();
    }

    ctx.hooks = null;
  },

  render(ctx, props, slots) {
    const children = slots.default ? getInnerChild(slots.default()) : [];

    setNodeTransition(children, ctx.hooks);

    return children;
  }
};
