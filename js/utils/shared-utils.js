/** Delay execution until calls have stopped for the specified time. */
export function debounce(func, wait) {
  let timeout;

  function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }

  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = undefined;
  };

  return debounced;
}
