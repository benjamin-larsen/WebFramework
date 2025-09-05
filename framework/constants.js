export const FUNCTION_CACHE_LIMIT = 20;
export const RESERVED_PROPS = new Set(["key"])

const BUILD_MODES = {
    DEV: "development",
    ALPHA: "alpha"
}

export const META = {
    mode: BUILD_MODES.DEV,
    version: "0.1.13"
}

export const INSTANCE_STATES = {
    BEFORE_MOUNT: 0,
    SYNCED: 1, // eqv to dirty: false
    UNSYNCED: 2 // eqv to dirty: true
}

export const REACTIVE_FLAGS = {
    IS_REACTIVE: Symbol("is_reactive"),
    IS_REF: Symbol("is_ref"),
    REF_VALUE: Symbol("ref_value")
}