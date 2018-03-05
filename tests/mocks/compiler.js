module.exports = class FakeCompiler {
  constructor() {
    this.callbacks = [];
  }

  plugin(event, callback) {
    this.callbacks[event] = callback;
  }

  trigger(event, args = []) {
    this.callbacks[event].apply(undefined, args);
  }
};
