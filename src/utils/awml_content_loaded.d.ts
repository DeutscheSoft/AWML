
/**
 * Register an async task to delay the `AWMLContentLoaded` event.
 * @param p 
 */
export function registerLoading(p: Promise<unknown>): void;

/**
 * Wait for the `AWMLContentLoaded` event to be emitted.
 */
export function waitForAWMLContentLoaded(): Promise<void>;