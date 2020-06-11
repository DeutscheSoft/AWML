/* eslint-disable no-empty */

/** @ignore */
export function log() {
  try {
    console.log.apply(console, arguments);
  } catch (err) {}
}

/** @ignore */
export function warn() {
  try {
    console.warn.apply(console, arguments);
  } catch (err) {}
}

/** @ignore */
export function error() {
  try {
    console.error.apply(console, arguments);
  } catch (err) {}
}
