export function timeout(cb, n) {
  let id;

  id = setTimeout(() => {
    id = -1;
    cb();
  }, n);

  return () => {
    if (id === -1) return;
    clearTimeout(id);
    id = -1;
  };
}
