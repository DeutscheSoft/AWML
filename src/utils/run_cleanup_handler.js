import { warn } from './log.js';

export function runCleanupHandler(cleanup) {
  if (cleanup === null) return;
  try {
    cleanup();
  } catch (error) {
    warn('Cleanup handler threw an exception:', error);
  }
}
