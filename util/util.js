/**
 * @fileoverview Random utility functions.
 */

/**
 * Removes repeated elements from a list.
 * @param {!Array<T>} xs
 * @return {!Array<T>}
 * @template T
 */
export function nub(xs) {
  if (!xs.length) return [];
  const out = [xs[0]];
  for (let x of xs) {
    if (x != out[out.length - 1]) out.push(x);
  }
  return out;
}
