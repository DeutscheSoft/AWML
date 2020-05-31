export function timeout(cb, n) {
  let id = setTimeout(cb, n);

  return () => {
    if (id === -1) return;
    clearTimeout(id);
    id = -1;
  };
}
