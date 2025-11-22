export class TeleportNode {
  constructor(opts, children) {
    this.children = children;
    this.keyMap = null;
    this.properties = opts;

    this.index = null;
    this.parent = null;
    this.anchor = null;
    this.el = null;
  }

  unmount() {
    this.anchor = null;

    for (const child of this.children) {
      if (!child) continue;
      child.unmount(false, false);
    }

    // Prevent Memory Leak
    this.parent = null;
    this.children = null;
  }

  move(parentEl, anchor, force) {
    if (!force && !this.properties.disabled) return;

    for (const child of this.children) {
      if (!child) continue;

      child.move(parentEl, anchor);
    }
  }
}

export function createTeleport(opts, children) {
  return new TeleportNode(opts, children);
}
