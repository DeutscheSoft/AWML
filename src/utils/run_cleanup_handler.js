import { warn } from './log.js';

export function runCleanupHandler(cleanup) {
  if (!cleanup) return;
  try {
    cleanup();
  } catch (error) {
    warn('Cleanup handler threw an exception:', error);
  }
}
