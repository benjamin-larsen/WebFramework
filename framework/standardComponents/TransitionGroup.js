import {
  TRANSITION_CLASS,
  TRANSITION_ENTER_CALLBACK,
  TRANSITION_LEAVE_CALLBACK,
  TRANSITION_MOVE_CALLBACK
} from '../constants.js';
import {
  addTransitionClass,
  removeTransitionClass,
  clearTransitionClass,
  getTransitionInfo
} from './Transition.js';
import { ComponentNode, ElementNode } from '../vnode.js';
import { TeleportNode } from '../Teleport.js';
import { evalDiff } from '../render/patching.js';

function getInnerChild(child) {
  if (!child) return [];

  if (Array.isArray(child)) return child;

  return [child];
}

function setNodeTransitionGroup(children, transition) {
  for (const child of children) {
    if (
      typeof child === 'object' &&
      (child.constructor === ElementNode ||
        child.constructor === ComponentNode ||
        child.constructor === TeleportNode)
    ) {
      if (child.transition) continue;

      if (transition._expectDepth) {
        child.transition = Object.create(transition, {
          depth: {
            value: 0,
            configurable: false,
            writable: false,
            enumerable: true
          }
        });

        continue;
      }

      child.transition = transition;
    }
  }
}

export default {
  onCreated(ctx, props) {
    ctx.hasMounted = props.appear ? true : false;
    ctx.hasChildren = false;

    let currentNode = null;

    const activeEnter = new Set();
    const activeLeave = new Set();
    const activeMove = new Set();

    // [key]: VNode Key
    // [value]: {
    //            node: VNode,
    //            cb: function callback
    //          }
    const leavingNodes = new Map();

    function cancelCurrentLeave() {
      if (!currentNode) return;

      const leavingNode = leavingNodes.get(currentNode.properties.key);
      if (!leavingNode) return;

      leavingNode.cb(undefined, true);
    }

    ctx.cancel = function () {
      for (const cb of activeEnter) {
        cb(undefined, true);
      }

      for (const cb of activeLeave) {
        cb(undefined, true);
      }

      for (const cb of activeMove) {
        cb(undefined, true);
      }
    };

    ctx.hooks = {
      _expectDepth: true,
      _isGroup: true,
      startOperation(node) {
        if (currentNode) return false;
        if (node.properties.key === undefined || node.properties.key === null) {
          return false;
        }

        currentNode = node;

        return true;
      },

      endOperation() {
        currentNode = null;
      },

      beforeEnter() {
        if (!currentNode) return;

        const leavingNode = leavingNodes.get(currentNode.properties.key);
        if (!leavingNode) return;

        if (!evalDiff(leavingNode.node, currentNode).isSame) return;
        leavingNode.cb(undefined, true);
      },

      onEnter(el) {
        if (!ctx.hasMounted) return;

        const className =
          typeof ctx.props.name === 'string' ? ctx.props.name : 'transition';

        el._isEntering = true;

        if (!el[TRANSITION_CLASS]) {
          el[TRANSITION_CLASS] = new Set();
        }

        addTransitionClass(el, `${className}-enter-from`);
        addTransitionClass(el, `${className}-enter-active`);

        let { timeout, animationCount, transitionCount } =
          getTransitionInfo(el);

        const enter = (e, isCancel = false) => {
          if (typeof e === 'object') {
            if (e.target !== el) return;
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

          activeEnter.delete(enter);
          el._isEntering = false;
          el[TRANSITION_ENTER_CALLBACK] = undefined;

          removeTransitionClass(el, `${className}-enter-active`);
          removeTransitionClass(el, `${className}-enter-to`);
        };

        activeEnter.add(enter);
        el[TRANSITION_ENTER_CALLBACK] = enter;

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
        cancelCurrentLeave();

        let key = currentNode ? currentNode.properties.key : null;
        if (key === undefined) key = null;

        const className =
          typeof ctx.props.name === 'string' ? ctx.props.name : 'transition';

        // Cancel Enter on same Element
        if (el[TRANSITION_ENTER_CALLBACK]) {
          el[TRANSITION_ENTER_CALLBACK](undefined, true);
        }

        if (el[TRANSITION_MOVE_CALLBACK]) {
          el[TRANSITION_MOVE_CALLBACK](undefined, true);
        }

        el._isLeaving = true;

        void (el ? el.ownerDocument : document).body.offsetHeight;

        // Dont need to use addTransitionClass, as element has left the vDOM.
        el.classList.add(`${className}-leave-from`);
        el.classList.add(`${className}-leave-active`);

        let { timeout, animationCount, transitionCount } =
          getTransitionInfo(el);

        const leave = (e, isCancel = false) => {
          if (typeof e === 'object') {
            if (e.target !== el) return;
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

          activeLeave.delete(leave);

          if (key !== null) {
            leavingNodes.delete(key);
          }

          el._isLeaving = false;
          el[TRANSITION_LEAVE_CALLBACK] = undefined;
          vnode.unmount(false, false);
        };

        activeLeave.add(leave);

        if (key !== null) {
          leavingNodes.set(key, { node: currentNode, cb: leave });
        }

        el[TRANSITION_LEAVE_CALLBACK] = leave;

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

  beforeDestroy(ctx) {
    ctx.cancel();
    ctx.hooks = null;
  },

  render(ctx, props, slots) {
    const children = slots.default ? getInnerChild(slots.default()) : [];

    setNodeTransitionGroup(children, ctx.hooks);

    if (children.length > 0) {
      ctx.hasChildren = true;
    }

    return children;
  }
};
