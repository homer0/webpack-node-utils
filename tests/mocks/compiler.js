'use strict';

module.exports = class FakeCompiler {

    constructor() {
        this.callbacks = [];
    }

    plugin(event, callback) {
        this.callbacks[event] = callback;
    }

    trigger(event, args) {
        args = args || [];
        this.callbacks[event].apply(undefined, args);
    }

};
