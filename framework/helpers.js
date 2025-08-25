export function shallowCompareObj(objA, objB) {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    /* We only need to compare one of the objects because of the previous check
       If a key is missing from the other Object, it will inheritely be undefined, and therefore not compare to the non-undefined key.
       The only way for keysA.length to equal keysB.length is if one item was added, and another was removed, meaning we would see the difference between the added key and removed key.

       Example:
       objA: { a: "1", b: "2" }
       objB: { a: "1", c: "2" }

       Here we would see:
       key = keysA[1] ("b")
       keysB.includes(key ("b")) = false
    */

    for (var i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!(key in keysB)) return false;

        const valA = objA[key];
        const valB = objB[key];

        if (valA !== valB) return false;
    }

    return true;
}