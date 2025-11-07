export const RESERVED_PROPS = new Set(['key']);

const BUILD_MODES = { DEV: 'development', ALPHA: 'alpha', STABLE: 'stable' };

export const META = { mode: BUILD_MODES.STABLE, version: '1.0.0' };

export const INSTANCE_STATES = {
  BEFORE_MOUNT: 0,
  SYNCED: 1, // eqv to dirty: false
  UNSYNCED: 2 // eqv to dirty: true
};

export const DIRECTIVE_STATES = { SYNCED: 0, SYNCED_MOUNT: 1, UNSYNCED: 2 };

export const REACTIVE_FLAGS = {
  UNWRAP: Symbol('reactive_unwrap'),
  IS_REACTIVE: Symbol('is_reactive'),
  IS_READONLY: Symbol('is_readonly'),
  IS_REF: Symbol('is_ref'),
  REF_VALUE: Symbol('ref_value')
};

export const EMPTY_PROPS = Object.freeze({});
export const EMPTY_ARR = Object.freeze([]);

export const NAMESPACES = {
  html: 'http://www.w3.org/1999/xhtml',
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML',
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/'
};

export const NAMESPACES_TAGS = { svg: NAMESPACES.svg, math: NAMESPACES.math };

export const EFFECT_STATES = {
  ENABLED: 1 << 0,
  PAUSED: 1 << 1,
  RUNNING: 1 << 2,
  AWAITING_EFFECT: 1 << 3
};
