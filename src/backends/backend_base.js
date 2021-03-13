import { EventTarget } from '../utils/event_target.js';
import { Subscriptions } from '../utils/subscriptions.js';

/**
 * @interface IPathInfo
 *
 * @property {string|number} [id]
 *      An optional id. This id is usually shorter than the full path
 *      and can be used to efficiently interact with the path.
 *
 * @property {string} [type]
 *      This type describes what this path is. Pre-defined types are
 *      ``parameter``, ``directory``, ``function`` or ``event``.
 *
 * @property {string} [access]
 *      This string describes the access level of this path. It may contain
 *      the usual characters:
 *
 *      - ``w`` for write permission,
 *      - ``r`` for read permission (for ``parameter``, ``directory`` and
 *        ``event`),
 *      - ``x`` for execute permission (for ``method`` type only).
 *
 * @property {string} [description]
 *      An optional human readable description.
 */

export class BackendBase extends EventTarget {
  get transformPath() {
    return this._transformPath;
  }

  set transformPath(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');

    this._transformPath = v;
  }

  get isOpen() {
    return this._state === 'open';
  }

  get isInit() {
    return this._state === 'init';
  }

  get isClosed() {
    return this._state === 'closed';
  }

  get isError() {
    return this._state === 'error';
  }

  get name() {
    return this._options.name;
  }

  get options() {
    return this._options;
  }

  get node() {
    return this._options.node || null;
  }

  log(...args) {
    const node = this._node;

    if (node) node.log(...args);
  }

  constructor(options) {
    super();
    this._options = options;
    this._state = 'init';
    this._eventSubscriptions = new Subscriptions();
  }

  addSubscription(...args) {
    this._eventSubscriptions.add(...args);
  }

  destroy() {
    this.emit('destroy');
    this._eventSubscriptions.unsubscribe();
    this._state = null;
    super.destroy();
  }

  open() {
    if (this.isOpen) return;
    if (!this.isInit) throw new Error('Invalid transition.');

    this._state = 'open';

    this.emit('open');
  }

  close() {
    if (this.isClosed) return;
    if (!this.isInit && !this.isOpen) throw new Error('Invalid transition.');

    this._state = 'closed';

    this.emit('close');

    this.destroy();
  }

  error(err) {
    if (this.isError) return;
    if (!this.isInit && !this.isOpen) throw new Error('Invalid transition.');

    this._state = 'error';

    this.emit('error', err);

    this.destroy();
  }

  assertOpen() {
    if (!this.isOpen) throw new Error('Not open.');
  }

  waitOpen() {
    return new Promise((resolve, reject) => {
      if (this.isOpen) {
        resolve();
        return;
      }

      if (!this.isInit) {
        reject(new Error('Is closed.'));
        return;
      }

      const subs = new Subscriptions();

      const onFail = () => {
        reject(new Error('Is closed.'));
        subs.unsubscribe();
      };

      subs.add(
        this.once('open', () => {
          resolve();
          subs.unsubscribe();
        }),
        this.once('close', onFail),
        this.once('error', onFail)
      );
    });
  }

  /**
   * @function resolvePath
   *
   * This optional method can be used to resolve the given path to an id
   * which identifies the same parameter.
   *
   * @param {string} path
   *    The path name.
   * @returns {*|Promise<*>}
   *    The identifier for the given path.
   */
  async resolvePath(path) {
    this.assertOpen();

    const info = await this.fetchInfo(path);

    if ('id' in info) {
      return info.id;
    } else {
      throw new Error('Parameter has no id.');
    }
  }

  /**
   * @function resolveId
   *
   * This optional method can be used to resolve the given id to the
   * corresponding path.
   *
   * @param {*} id
   *    The identifier.
   * @returns {*|Promise<*>}
   *    The path.
   */

  /**
   * @function setByPath
   *
   * Set's the value of a parameter with given path name.
   *
   * @param {string} path
   *    The parameter path.
   * @param {*} value
   *    The parameter value.
   * @returns {Promise<*>|undefined}
   */
  async setByPath(path, value) {
    const id = await this.resolvePath(path);

    this.assertOpen();

    return this.setById(id, value);
  }

  /**
   * Callbacks for observeInfo should implement this signature.
   *
   * @callback ObserInfoCallback
   * @param {boolean|number} ok
   *    Is truthy if the returned data is a IPathInfo object.
   * @param {boolean|number} last
   *    Is truthy if this is the last value emitted. On error this means
   *    that the given path is permanently unavailable. On success this means
   *    that the resulting path info will not change.
   * @param {IPathInfo|Error} data
   *    Either the resulting path info or an error.
   */

  /**
   * @function observeInfo
   *
   * Subscribes to the information about the given path. If successful, this
   * subscription will emit information about the given path.
   *
   * @param {string} path
   *    The path name.
   * @param {ObserveInfoCallback} callback
   *    The callback.
   * @returns {function}
   *    The unsubscribe function.
   */

  /**
   * @function fetchInfo
   *
   * Fetches the information about the given path. If successful, this
   * subscription will emit information about the given path.
   *
   * @param {string} path
   *    The path name.
   * @returns {IPathInfo}
   *    The path information.
   */
  fetchInfo(path) {
    if (typeof path !== 'string') throw new TypeError('Expected path.');

    return new Promise((resolve, reject) => {
      let sub;

      sub = this.observeInfo(path, (ok, last, data) => {
        if (!last) sub();

        (ok ? resolve : reject)(data);
      });
    });
  }

  /**
   * @function observeById
   *
   * Subscribe to changes of a parameter.
   *
   * @param {string|number} id
   *    The id.
   * @param {(ok: boolean, last: boolean, data) => void} callback
   *    The subscription callback.
   * @returns {() => void}
   *    A unsubscription callback.
   */

  /**
   * @function observeByPath
   *
   * Subscribe to changes of a parameter.
   *
   * @param {string} path
   *    The parameter path.
   * @param {(ok: boolean, last: boolean, data) => void} callback
   *    The subscription callback.
   * @returns {() => void}
   *    A unsubscription callback.
   */
  observeByPath(path, callback) {
    let inner_sub = null;

    let outer_sub = this.observeInfo(path, (ok, last, info) => {
      if (inner_sub !== null) inner_sub();

      inner_sub = null;

      if (ok) {
        inner_sub = this.observeById(info.id, callback);
      } else {
        callback(ok, last, info);
      }
    });

    return () => {
      if (outer_sub !== null) outer_sub();
      outer_sub = null;

      if (inner_sub !== null) inner_sub();

      inner_sub = null;
    };
  }

  /**
   * Returns true if this backend uses ids.
   */
  supportsIds() {
    return typeof this.observeById === 'function';
  }

  /**
   * Calls a method with the given id. This method can only be used on paths
   * which have type ``function``.
   *
   * @function callById
   * @param {string|int} id
   *    The unique id of this function.
   * @param {*[]} args
   *    The arguments to this function.
   * @returns {Promise<*>}
   *    The return value.
   */

  /**
   * Calls a method with the given path. This method can only be used on paths
   * which have type ``function``.
   *
   * @function callById
   * @param {string|int} id
   *    The unique id of this function.
   * @param {*[]} args
   *    The arguments to this function.
   * @returns {Promise<*>}
   *    The return value.
   */
  async callByPath(path, args) {
    const id = await this.resolvePath(path);

    this.assertOpen();

    return this.callById(id, args);
  }

  fetchByPath(path) {
    return new Promise((resolve, reject) => {
      let sub = null;
      let done = false;

      sub = this.observeByPath(path, (ok, last, data) => {
        (ok ? resolve : reject)(data);
        done = true;

        if (last) sub = null;

        if (sub !== null) sub();
      });

      if (done && sub !== null) sub();
    });
  }

  fetchById(id) {
    return new Promise((resolve, reject) => {
      let sub = null;
      let done = false;

      sub = this.observeById(id, (ok, last, data) => {
        (ok ? resolve : reject)(data);
        done = true;

        if (last) sub = null;

        if (sub !== null) sub();
      });

      if (done && sub !== null) sub();
    });
  }

  static argumentsFromNode(node) {
    return {
      node: node,
      name: node.name,
    };
  }
}
