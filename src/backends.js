import { BackendValue } from './backend_value.js';
import { DynamicValue } from './dynamic_value.js';
import { ListValue } from './list_value.js';
import { map, unique, filter, switchMap } from './operators.js';
import { combineSubscriptions } from './utils/combine_subscriptions.js';
import {
  initSubscribers,
  callSubscribers,
  addSubscriber,
} from './utils/subscribers.js';

let backendAdded = initSubscribers();
let backendRemoved = initSubscribers();

const backendValues = new Map();
const backends = new Map();
const backends$ = DynamicValue.fromConstant(backends);
const backendsReadonly$ = map(backends$, (backends) => backends);

/**
 * Get the backend currently registered for the given name.
 *
 * @param name {string} The backend name.
 * @return {Backend}
 */
export function getBackend(name) {
  return backends.get(name);
}

/**
 * Waits for a backend with the given name to become available (i.e. `open`).
 *
 * @param {string} name
 *      The backend name.
 * @returns {Promise<Backend>}
 */
export function waitForBackend(name) {
  if (backends.has(name)) {
    return Promise.resolve(backends.get(name));
  } else {
    return filter(observeBackend(name), (backend) => !!backend).wait();
  }
}

/**
 * Register a backend under a name.
 *
 * @param {string} name
 *      The backend name.
 * @param {Backend} backend
 *      The backend object. The backend should be in ``open`` state.
 */
export function registerBackend(name, backend) {
  if (backends.has(name)) {
    throw new Error('Backend already exists.');
  }

  backends.set(name, backend);
  backends$.set(backends);

  const values = backendValues.get(name);

  if (values !== void 0) {
    values.forEach((backendValue) => {
      backendValue.connectBackend(backend);
    });
  }

  callSubscribers(backendAdded, name, backend);
}

/**
 * Unregister a backend with the given name.
 *
 * @param {string} name
 *      The backend name.
 * @param {Backend} backend
 *      The backend object. The backend should be in ``open`` state.
 */
export function unregisterBackend(name, backend) {
  if (backend !== backends.get(name)) {
    throw new Error('Unregistering wrong backend.');
  }

  backends.delete(name);
  backends$.set(backends);

  const values = backendValues.get(name);

  if (values !== void 0) {
    values.forEach((backendValue) => {
      backendValue.disconnectBackend();
    });
  }

  callSubscribers(backendRemoved, name, backend);
}

export function provideBackend(name, dv) {
  const backendIfOpen$ = switchMap(dv, (backend) => {
    if (!backend) return DynamicValue.fromConstant(null);

    return map(backend.state$, (state) => {
      if (state === 'open') {
        return backend;
      } else {
        return null;
      }
    });
  });

  let lastBackend = null;

  const unregister = () => {
    if (lastBackend !== null) {
      unregisterBackend(name, lastBackend);
      lastBackend = null;
    }
  };

  const register = (backend) => {
    if (!backend) return;
    registerBackend(name, backend);
    lastBackend = backend;
  };

  return combineSubscriptions(
    unregister,
    backendIfOpen$.subscribe((backend) => {
      unregister();
      register(backend);
    })
  );
}

/**
 * Return a Map of all backend values which currently exist for the given
 * backend name.
 *
 * @return {Map<string,BackendValue>}
 */
export function getBackendValues(backendName) {
  let result = backendValues.get(backendName);

  if (result !== void 0) return result;

  result = new Map();

  backendValues.set(backendName, result);

  return result;
}

/**
 * Print a sorted Map of all backend values which currently exist for the given
 * backend name.
 *
 * @param {string} backendName - Name of the backend
 * @param {string} match - Match parameter URI against this regular expression
 * @param {number} timeout - Timeout in milliseconds the subscription should
 *   wait for the results, default is 1000.
 */
export function printBackendValues(backendName, match, timeout) {
  let backend = backendValues.get(backendName);
  const defto = 100;

  if (backend == void 0) backend = new Map();

  const _keys = [...backend.keys()];
  _keys.sort(function (a, b) {
    return a.localeCompare(b);
  });

  const values = [];
  const keys = [];
  //let chars = 0;
  for (let i = 0, m = _keys.length; i < m; ++i) {
    if (match) {
      if (!_keys[i].match(match)) continue;
    }
    values.push(backend.get(_keys[i]));
    keys.push(_keys[i]);
    //chars = Math.max(chars, _keys[i].length);
  }
  const listbind = new ListValue(values, true, timeout || defto);

  console.log(
    '%c### Reading from backend %c"%s"%c (timeout: %ims)',
    'color:#2CB9FE',
    'color:#FFAB0F',
    backendName,
    'color:#2CB9FE',
    timeout || defto
  );
  listbind.wait().then(function (result) {
    for (let i = 0, m = keys.length; i < m; ++i) {
      //const spaces = new Array(chars - keys[i].length + 1).join(" ");
      const URI = keys[i].substr(backendName.length + 1);
      switch (typeof result[i]) {
        case 'undefined':
          console.log('%s : %c%s', URI, 'color:#808080', result[i]);
          break;
        case 'object':
          if (result[i] === null)
            console.log('%s : %c%O', 'color:#FFAB0F', URI, result[i]);
          else console.log('%s : %O', URI, result[i]);
          break;
        case 'boolean':
          console.log(
            '%s : %c%s',
            URI,
            result[i] ? 'color:#00CF75' : 'color:#AA0044',
            result[i]
          );
          break;
        case 'number':
          console.log('%s : %c%s', URI, 'color:#A261FF', result[i]);
          break;
        case 'string':
          console.log('%s : %c"%s"', URI, 'color:#2CB9FE', result[i]);
          break;
        default:
          console.log('%s : %c%s', URI, 'color:#2CB9FE', result[i]);
          break;
      }
    }
  });
  return keys.length;
}

/**
 * Get the BackendValue for the given address. Addresses have the form
 * `<backendName>:<path>`.
 *
 * @param {string} address
 * @return {BackendValue}
 */
export function getBackendValue(address) {
  const pos = address.search(':');

  if (pos === -1) throw new TypeError('Bad address.');

  const backendName = address.substr(0, pos);
  const backendValues = getBackendValues(backendName);

  let backendValue = backendValues.get(address);

  if (backendValue !== void 0) return backendValue;

  backendValue = new BackendValue(address);
  backendValues.set(address, backendValue);

  const backend = getBackend(backendName);

  if (backend !== void 0) {
    backendValue.connectBackend(backend);
  }

  return backendValue;
}

/**
 * Return all backends.
 *
 * @return {Map<string,Backend>}
 */
export function getBackends() {
  return backends;
}

/**
 * Returns a DynamicValue which emits the map with all backends.
 *
 * @return {DynamicValue<Map<string,Backend>>}
 */
export function observeBackends() {
  return backendsReadonly$;
}

const observeBackendsCache = new Map();

/**
 * Returns a DynamicValue that emits the current backend with the
 * given name or undefined.
 *
 * @param {string} name
 * @return {DynamicValue<BackendBase>}
 */
export function observeBackend(name) {
  let value$ = observeBackendsCache.get(name);
  if (!value$) {
    value$ = unique(map(backends$, (backends) => backends.get(name)));
    observeBackendsCache.set(name, value$);
  }
  return value$;
}

if (typeof document !== 'undefined') {
  backendAdded = addSubscriber(backendAdded, (name, backend) => {
    const ev = new CustomEvent('AWMLBackendRegistered', {
      detail: {
        protocol: name,
        name: name,
        backend: backend,
      },
    });
    document.dispatchEvent(ev);
  });
  backendRemoved = addSubscriber(backendRemoved, (name, backend) => {
    const ev = new CustomEvent('AWMLBackendUnregistered', {
      detail: {
        protocol: name,
        name: name,
        backend: backend,
      },
    });
    document.dispatchEvent(ev);
  });
}
