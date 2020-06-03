export function log() {
  try {
    console.log.apply(console, arguments);
  } catch (err) {}
}

export function warn() {
  try {
    console.warn.apply(console, arguments);
  } catch (err) {}
}

export function error() {
  try {
    console.error.apply(console, arguments);
  } catch (err) {}
}