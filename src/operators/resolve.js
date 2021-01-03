import { DynamicValue } from '../dynamic_value.js';
import { warn } from '../utils/log.js';

class ResolveValue extends DynamicValue {
  constructor(dv, projection, all) {
    super();
    this._other = dv;
    this._projection = projection;
    this._all = all;
  }

  _subscribe() {
    let active = true;

    // If all is true, this list contains other pending tasks in
    // the order in which they appeared.
    // If all is false, this list contains the current pending task and (if it
    // arrived) the last value.
    const tasks = [];

    const all = this._all;

    /* eslint-disable prefer-const */
    let onValue;
    /* eslint-enable prefer-const */

    const onTaskCompleted = all
      ? (val) => {
          if (!active) return;
          this._updateValue(val);
          tasks.shift();
          if (tasks.length === 0) return;
          tasks[0].then(onTaskCompleted);
        }
      : (val) => {
          if (!active) return;
          this._updateValue(val);

          if (tasks.length === 2) {
            const x = tasks[1];
            tasks.length = 0;
            onValue(x);
          } else {
            tasks.length = 0;
          }
        };
    onValue = (x) => {
      const projection = this._projection;

      if (!all) {
        // another task is ongoing, just store the value and
        // wait for the task to complete
        if (tasks.length) {
          tasks[1] = x;
          return;
        }
      }

      const task = projection(x).catch((error) => {
        if (!active) return;
        warn('resolve() task generated an error:', error);
      });

      if (task === null) return;

      tasks.push(task);

      if (tasks.length === 1) task.then(onTaskCompleted);
    };

    const outer_sub = this._other.subscribe(onValue);

    return () => {
      outer_sub();
      active = false;
    };
  }

  set(x) {
    this._other.set(x);
  }
}

/**
 * This transformation can be used to start an asynchronous task for each value
 * emitted.
 * The returned DynamicValue will emit one value for each result of a resolved
 * task. Tasks which fail will be caught and generate a warning in the console.
 *
 * @param {DynamicValue} dv
 *      The input DynamicValue.
 * @param {function(*):Promise} projection
 *      Transformation function for values.
 * @param {boolean} [parallel=false]
 *      If true, each value will spawn a task and
 *      all their values will be emitted in order. If false, only one task may
 *      be running at the same time.
 * @return {DynamicValue}
 */
export function resolve(dv, projection, parallel) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (typeof projection !== 'function')
    throw new TypeError('Expected function.');

  if (parallel === void 0) {
    parallel = false;
  } else if (typeof parallel !== 'boolean') {
    throw new TypeError('Expected boolean.');
  }

  return new ResolveValue(dv, projection, parallel);
}
