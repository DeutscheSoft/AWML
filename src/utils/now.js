function performanceNow() {
  return performance.now();
}

function dateNow() {
  return Date.now();
}

export const now =
  typeof performance === 'undefined' ? dateNow : performanceNow;
