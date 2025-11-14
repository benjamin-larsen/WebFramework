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

export const TRANSITION_CLASS = Symbol('transition_class');
export const TRANSITION_ENTER_CALLBACK = Symbol('transition_enter_callback');
export const TRANSITION_LEAVE_CALLBACK = Symbol('transition_leave_callback');

export const NAMESPACES = {
  html: 'http://www.w3.org/1999/xhtml',
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML',
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/'
};

export const NAMESPACES_TAGS = { svg: NAMESPACES.svg, math: NAMESPACES.math };

export const ITERATE_KEY = Symbol('iterate_key');

export const EFFECT_STATES = {
  /* If ENABLED is not present, Effect is destroyed and can no logner be used. */
  ENABLED: 1 << 0,
  /* If PAUSED is present, trigger() will temporarily be queued until resumed. */
  PAUSED: 1 << 1,
  /* If RUNNING is present, it means that the effect is running function. */
  RUNNING: 1 << 2,
  /* If AWAITING_EFFECT is present, trigger() will be called when Effect resumes. */
  AWAITING_EFFECT: 1 << 3,
  /* If ASYNC_EFFECT is present, the Effect will setup nesscary components for awaitEffect */
  ASYNC_EFFECT: 1 << 4
};

export const TRIGGER_TYPES = {
  ADD: 0,
  SET: 1,
  DELETE: 2,
  CLEAR: 3,
  UPDATE_ARRAY: 4
};
