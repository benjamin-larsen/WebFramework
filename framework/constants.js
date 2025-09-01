export const FUNCTION_CACHE_LIMIT = 20;
export const RESERVED_PROPS = new Set(["key"])

export const INSTANCE_STATES = {
    BEFORE_MOUNT: 0,
    SYNCED: 1, // eqv to dirty: false
    UNSYNCED: 2 // eqv to dirty: true
}