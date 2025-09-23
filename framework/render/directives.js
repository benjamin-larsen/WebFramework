import { DIRECTIVE_STATES, INSTANCE_STATES, EMPTY_ARR } from '../constants.js';
import { DependencySubscriber, withTracking } from '../effect.js';
import { renderQueue } from './index.js';

function queueReact(dir) {
  renderQueue.queueDirective(dir);
}

class ReactiveDirective {
  constructor(node, dir, binding) {
    this.node = node;
    this.dir = dir;
    this.binding = binding;
    this.status = INSTANCE_STATES.UNSYNCED;
    this.sub = new DependencySubscriber(queueReact.bind(null, this));
  }

  runReact(force = false) {
    if (!force && this.status !== INSTANCE_STATES.UNSYNCED) return;

    try {
      withTracking(
        this.sub,
        this.dir.onReact.bind(
          null,
          this.node.el, // el
          this.binding, // binding
          this.node, // VNode
          null // prevVNode
        )
      );

      this.status = INSTANCE_STATES.SYNCED;
    } catch {
      console.log('Error occured while running Directive Hook: onReact', e);
    }
  }

  destroy() {
    this.sub.destroy();
    this.sub = null;
    this.node = null;
    this.dir = null;
    this.binding = null;
  }
}

function callDirectiveHook(dir, hookName, ...args) {
  if (typeof dir[hookName] === 'function') {
    try {
      dir[hookName](...args);
    } catch (e) {
      console.log(`Error occured while running Directive Hook: ${hookName}`, e);
    }
  }
}

export function destroyDirective(dir, binding, node) {
  if (binding.react) {
    binding.react.destroy();
  }

  callDirectiveHook(dir, 'onDestroy', node.el, binding, node);
}

export function patchElementDirectives(prevNode, nextNode) {
  const hasPrev =
    !!prevNode && !!prevNode.dirs && prevNode.dirs.constructor === Map;
  const hasNext = Array.isArray(nextNode.dirs);

  if (!hasPrev && !hasNext) return; // Neither need to add or remove directives, skip.

  const map = hasPrev ? prevNode.dirs : new Map();
  const dirs = hasNext ? nextNode.dirs : EMPTY_ARR;

  for (const [_, dirDef] of map) {
    dirDef.status = DIRECTIVE_STATES.UNSYNCED;
  }

  for (var i = 0; i < dirs.length; i++) {
    const nextBinding = dirs[i];

    const directive = nextBinding.dir;
    const prevBinding = map.get(directive);

    if (prevBinding) {
      /*
        If prevBinding is found and status is not unsynced,
        that means it was added after all directive statuses were set to UNSYNCED.

        Therefore must mean that it was a duplicate directive.
      */
      if (prevBinding.status !== DIRECTIVE_STATES.UNSYNCED)
        throw Error("Duplicate directive's not allowed.");

      if (prevBinding.react) {
        nextBinding.react = prevBinding.react;

        nextBinding.react.node = nextNode;
        nextBinding.react.binding = nextBinding;
      }

      nextBinding.oldValue = prevBinding.value;
      nextBinding.status = DIRECTIVE_STATES.SYNCED;

      callDirectiveHook(
        directive,
        'beforeUpdate',
        nextNode.el,
        nextBinding,
        nextNode,
        prevNode
      );
    } else {
      nextBinding.status = DIRECTIVE_STATES.SYNCED_MOUNT;

      if (typeof directive.onReact === 'function') {
        nextBinding.react = new ReactiveDirective(
          nextNode,
          directive,
          nextBinding
        );
      }

      callDirectiveHook(
        directive,
        'beforeMount',
        nextNode.el,
        nextBinding,
        nextNode
      );
    }

    map.set(directive, nextBinding);
  }

  nextNode.dirs = map;
}

export function finishElementDirectives(prevNode, nextNode) {
  if (!nextNode.dirs || nextNode.dirs.constructor !== Map) return;

  const map = nextNode.dirs;

  for (const [dir, binding] of map) {
    switch (binding.status) {
      case DIRECTIVE_STATES.UNSYNCED: {
        if (!prevNode)
          throw Error('Internal Error: Unsynced Directive without PrevNode.');

        destroyDirective(dir, binding, prevNode);
        map.delete(dir);
        break;
      }

      case DIRECTIVE_STATES.SYNCED: {
        if (binding.react) {
          binding.react.runReact(true);
        }

        callDirectiveHook(
          dir,
          'onUpdated',
          nextNode.el,
          binding,
          nextNode,
          prevNode
        );
        break;
      }

      case DIRECTIVE_STATES.SYNCED_MOUNT: {
        if (binding.react) {
          binding.react.runReact(true);
        }

        callDirectiveHook(dir, 'onMounted', nextNode.el, binding, nextNode);
        break;
      }
    }
  }
}
