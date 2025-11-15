export function shallowCompareObj(objA, objB) {
  if (objA === objB) return true;

  const keys = Object.keys(objA);

  if (keys.length !== Object.keys(objB).length) return false;

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

  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!(key in objB)) return false;

    const valA = objA[key];
    const valB = objB[key];

    if (valA !== valB) return false;
  }

  return true;
}

export function handleAsyncError(func, self, onError, ...args) {
  try {
    const res = func.apply(self, args);

    if (
      res &&
      typeof res === 'object' &&
      typeof res.then === 'function' &&
      typeof res.catch === 'function'
    ) {
      res.catch((e) => onError(e, true));
    }

    return res;
  } catch (e) {
    onError(e, false);

    return null;
  }
}

// Code from Vue (@vue/shared)
export function isIntegerKey(key) {
  return (
    typeof key === 'string' &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key
  );
}

const emptyIterator = {
  next() {
    return { done: true };
  }
};

export const mockMap = {
  get() {
    return undefined;
  },

  set() {
    return undefined;
  },

  delete() {
    return undefined;
  },

  [Symbol.iterator]() {
    return emptyIterator;
  }
};

window.mockMap = mockMap;
