import { TRANSITION_CLASS } from '../constants.js';
import { ComponentNode, ElementNode } from '../vnode.js';
import { evalDiff } from '../render/patching.js';

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

function getStyleList(styles, style) {
  const value = styles[style];
  if (typeof value !== 'string') return [];

  return value.split(', ');
}

function computeCSSTime(rawTime) {
  if (!rawTime) return 0;
  if (!rawTime.endsWith('s')) return 0;

  const num = Number(rawTime.slice(0, -1).replace(',', '.')) * 1000 || 0;

  return num > 0 ? num : 0;
}

function computeIteration(rawTime) {
  if (!rawTime) return 1;
  if (rawTime === 'infinite') {
    console.warn("<Transition> can't be provided with infinite iteartion.");
    return null;
  }

  const num = Number(rawTime.replace(',', '.')) || 0;

  return num > 0 ? num : 0;
}

function computeTimeout(delays, durations, iterations) {
  if (durations.length === 0) return 0;

  return Math.max(
    ...durations.map((duration, index) => {
      const iteration = computeIteration(iterations[index]);
      if (iteration === null) return 0;

      return (
        computeCSSTime(duration) * iteration + computeCSSTime(delays[index])
      );
    })
  );
}

function getTransitionInfo(el) {
  const styles = window.getComputedStyle(el);

  const transitionCount = getStyleList(styles, 'transitionProperty').length;
  const tranDelay = getStyleList(styles, 'transitionDelay').slice(
    0,
    transitionCount
  );
  const tranDuration = getStyleList(styles, 'transitionDuration').slice(
    0,
    transitionCount
  );
  const tranTimeout = computeTimeout(tranDelay, tranDuration, []);

  const animationCount = getStyleList(styles, 'animationName').length;
  const animDelay = getStyleList(styles, 'animationDelay').slice(
    0,
    animationCount
  );
  const animDuration = getStyleList(styles, 'animationDuration').slice(
    0,
    animationCount
  );
  const animIterations = getStyleList(styles, 'animationIterationCount').slice(
    0,
    animationCount
  );
  const animTimeout = computeTimeout(animDelay, animDuration, animIterations);

  const timeout = Math.max(animTimeout, tranTimeout);

  console.log({tranDelay, tranDuration})

  return {
    timeout,
    animationCount: animTimeout > 0 ? animationCount : 0,
    transitionCount: tranTimeout > 0 ? transitionCount : 0
  };
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

export default {
  onCreated(ctx, props) {
    ctx.pendingRemove = null;
    ctx.leavingNode = null;
    ctx.hasMounted = props.appear ? true : false;

    ctx.hooks = {
      beforeEnter(vnode) {
        if (!evalDiff(ctx.leavingNode, vnode).isSame) return;
        if (ctx.pendingRemove) {
          ctx.pendingRemove();
        }
      },

      onEnter(el) {
        if (!ctx.hasMounted) return;

        const className = typeof ctx.props.name === 'string' ? ctx.props.name : 'transition';

        el._isEntering = true;

        if (!el[TRANSITION_CLASS]) {
          el[TRANSITION_CLASS] = new Set();
        }

        addTransitionClass(el, `${className}-enter-from`);
        addTransitionClass(el, `${className}-enter-active`);

        let { timeout, animationCount, transitionCount } =
          getTransitionInfo(el);

        const enter = (e) => {
          if (typeof e === 'object') {
            if (e.type === 'transitionend') {
              transitionCount--;

              if (transitionCount === 0) {
                el.removeEventListener('transitionend', enter);
              }
            } else if (e.type === 'animationend') {
              animationCount--;

              if (animationCount === 0) {
                el.removeEventListener('animationend', enter);
              }
            }

            if (transitionCount !== 0 || animationCount !== 0) return false;
          }

          el.removeEventListener('transitionend', enter);
          el.removeEventListener('animationend', enter);

          if (!el._isEntering) return;

          el._isEntering = false;

          clearTransitionClass(el);
        };

        if (transitionCount > 0) {
          el.addEventListener('transitionend', enter);
        }

        if (animationCount > 0) {
          el.addEventListener('animationend', enter);
        }

        if (timeout === 0 || (transitionCount === 0 && animationCount === 0)) {
          enter();
        } else {
          requestAnimationFrame(() => {
            if (!el._isEntering) return;

            removeTransitionClass(el, `${className}-enter-from`);
            addTransitionClass(el, `${className}-enter-to`);

            setTimeout(enter, timeout + 10);
          });
        }
      },

      onLeave(el, vnode) {
        if (ctx.pendingRemove) {
          ctx.pendingRemove();
        }

        const className = typeof ctx.props.name === 'string' ? ctx.props.name : 'transition';

        el._isEntering = false;
        el._isLeaving = true;

        clearTransitionClass(el);

        // Dont need to use addTransitionClass, as element has left the vDOM.
        el.classList.add(`${className}-leave-from`);
        el.classList.add(`${className}-leave-active`);

        let { timeout, animationCount, transitionCount } =
          getTransitionInfo(el);

        const leave = (e) => {
          if (typeof e === 'object') {
            if (e.type === 'transitionend') {
              transitionCount--;

              if (transitionCount === 0) {
                el.removeEventListener('transitionend', leave);
              }
            } else if (e.type === 'animationend') {
              animationCount--;

              if (animationCount === 0) {
                el.removeEventListener('animationend', leave);
              }
            }

            if (transitionCount !== 0 || animationCount !== 0) return false;
          }

          el.removeEventListener('transitionend', leave);
          el.removeEventListener('animationend', leave);

          if (!el._isLeaving) return;

          ctx.leavingNode = null;
          ctx.pendingRemove = null;
          el._isLeaving = false;
          vnode.unmount(false, false);
        };

        ctx.leavingNode = vnode;
        ctx.pendingRemove = leave;

        if (transitionCount > 0) {
          el.addEventListener('transitionend', leave);
        }

        if (animationCount > 0) {
          el.addEventListener('animationend', leave);
        }

        if (timeout === 0 || (transitionCount === 0 && animationCount === 0)) {
          leave();
        } else {
          requestAnimationFrame(() => {
            if (!el._isLeaving) return;

            el.classList.remove(`${className}-leave-from`);
            el.classList.add(`${className}-leave-to`);

            setTimeout(leave, timeout + 10);
          });
        }
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
