/**
 * Runs a coroutine.
 * @param {function(): (function(): T)} gen A generator function.
 * @return {!Promise<T>} The final returned result.
 * @template T
 */

export function run(gen) {
  return run_(gen(), void 0);
}

function run_(iter, last) {
  const result = iter.next(last);
  if (result.done) return result.value;
  return result.value.then(x => run_(iter, x));
}
