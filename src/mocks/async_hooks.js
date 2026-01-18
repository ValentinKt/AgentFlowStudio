export class AsyncLocalStorage {
  disable() {}
  getStore() { return undefined; }
  run(store, callback, ...args) { return callback(...args); }
  exit(callback, ...args) { return callback(...args); }
  enterWith(store) {}
}
