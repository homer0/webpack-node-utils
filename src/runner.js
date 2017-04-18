/* eslint strict: 0, no-console:0, class-methods-use-this:0 */

'use strict';

const path = require('path');
const fork = require('child_process').fork;
const colors = require('colors/safe');

class WebpackNodeUtilsRunner {

    constructor(entry) {
        this._entry = entry || null;
        this._entryPath = null;
        this._running = false;
        this._instance = null;
        this._setup = false;
        this._logColors = {
            info: 'grey',
            error: 'red',
            warn: 'yellow',
            success: 'green',
        };

        this._defineLogMethods();
        this._bindMethods();
    }

    apply(compiler) {
        compiler.plugin('after-emit', this._onAssetsEmitted);
        compiler.plugin('compile', this._onCompilationStarts);
        compiler.plugin('done', this._onCompilationEnds);
    }

    _defineLogMethods() {
        Object.keys(this._logColors).forEach((name) => {
            const fname = name.substr(0, 1).toUpperCase() + name.substr(1);
            this[`_log${fname}`] = msg => this._log(msg, this._logColors[name]);
        });
    }

    _bindMethods() {
        [
            'apply',
            '_onAssetsEmitted',
            '_onCompilationStarts',
            '_onCompilationEnds',
        ].forEach(m => (this[m] = this[m].bind(this)));
    }

    _onAssetsEmitted(compilation, callback) {
        if (!this._setup) {
            this._setup = true;
            const entries = Object.keys(compilation.assets)
                .filter(a => a.indexOf('hot-update') < 0);

            this._log();
            if (this._entry && entries.indexOf(this._entry) === -1) {
                this._logError(`The required entry (${this._entry}) doesn't exist`);
                this._entry = null;
                this._logAvailableEntries(entries);
            } else if (!this._entry && entries.length === 1) {
                this._entry = entries[0];
                this._logSuccess(`Using the only available entry: ${this._entry}`);
            } else if (!this._entry && entries.length > 1) {
                this._entry = entries[0];
                this._logWarn(`Doing fallback to the first entry: ${this._entry}`);
                this._logAvailableEntries(entries);
            } else {
                this._logSuccess(`Using the following entry: ${this._entry}`);
            }

            if (this._entry) {
                this._entryPath = path.resolve(compilation.assets[this._entry].existsAt);
                this._logSuccess(`Entry file: ${this._entryPath}`);
            }
        }

        callback();
    }

    _onCompilationStarts() {
        if (this._entry && this._running && this._instance) {
            this._logInfo('Stopping bundle process');
            this._instance.kill();
            this._instance = null;
            this._running = false;
        }
    }

    _onCompilationEnds() {
        if (this._entry && !this._running) {
            this._instance = fork(this._entryPath);
            this._log();
            this._logSuccess('Starting bundle process');
            this._running = true;
        }
    }

    _logAvailableEntries(entries) {
        const list = entries.join(', ');
        this._logInfo(`These are the available entries: ${list}`);
    }

    _log(msg, color) {
        const logMsg = msg ? `[WebpackNodeUtilsRunner] ${msg}` : '';
        const logColor = color || 'white';
        console.log(colors[logColor](logMsg));
    }

}

module.exports = WebpackNodeUtilsRunner;
