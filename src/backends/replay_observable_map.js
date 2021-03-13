export class ReplayObservableMap {
  constructor(observableFactory) {
    this._observableFactory = observableFactory;
    this._observables = new Map();
  }

  subscribe(path, callback) {
    const observables = this._observables;

    let observable = observables.get(path);

    if (!observable) {
      observable = this._observableFactory(path);

      this._observables.set(path, observable);
    }

    return observable.subscribe(callback);
  }

  dispose() {
    this._observables.forEach((observable) => observable.dispose());
  }
}
