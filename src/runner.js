/* eslint-disable no-console, class-methods-use-this */

const path = require('path');
const { fork } = require('child_process');
const colors = require('colors/safe');
/**
 * This is a Webpack plugin for Node apps that allows the developer to start/stop the bundle
 * execution while Webpack _watches_ the files.
 * Based on https://github.com/ericclemmons/start-server-webpack-plugin.
 * @class
 */
class WebpackNodeUtilsRunner {
  /**
   * Class constructor.
   * @param {String|Null} entry Optional. The name of the Webpack entry the plugin will execute
   *                            when the Webpack finishes building the files. If it's empty, the
   *                            plugin will use the first one on the list of assets Webpack
   *                            provides during compilation time.
   * @return {WebpackNodeUtilsRunner}
   */
  constructor(entry) {
    /**
     * The name of the Webpack entry the plugin will execute when the files change. It's value
     * may be overwritten during the Webpack `compile` event (on the `_onAssetsEmitted` method).
     * @type {String|Null}
     * @ignore
     */
    this._entry = entry || null;
    /**
     * On the Webpack `compile` event, the plugin will use this property to save the absolute
     * path to the build file.
     * @type {String|Null}
     */
    this._entryPath = null;
    /**
     * A flag for the plugin to know if the build it's currently being executed or not.
     * @type {Boolean}
     */
    this._running = false;
    /**
     * When the build is executed, this property will store the instance of the process, so it
     * can later be _killed_.
     * @type {Object|Null}
     */
    this._instance = null;
    /**
     * A flag for the plugin to know if the build information was already obtained and avoid
     * running the same logic for every Webpack `after-emit` event.
     * @type {Boolean}
     */
    this._setup = false;
    /**
     * A dictionary of type of logs and colors for them that the plugin will use to build
     * methods that log messages on their respective colors, using the `colors` package.
     * @type {Object}
     */
    this._logColors = {
      info: 'grey',
      error: 'red',
      warn: 'yellow',
      success: 'green',
    };

    this._defineLogMethods();
    this._bindMethods();
  }
  /**
   * This is the method Webpack calls in order for the plugin to hook to the required events.
   * @param {Object} compiler The Webpack compiler.
   */
  apply(compiler) {
    compiler.plugin('after-emit', this._onAssetsEmitted);
    compiler.plugin('compile', this._onCompilationStarts);
    compiler.plugin('done', this._onCompilationEnds);
  }
  /**
   * Using the `_logColors` property, this method creates (more) methods for logging different
   * events of the plugin. For example, on the `_logColors` dictionary you have `info: 'grey'`,
   * this method creates a `_logInfo(msg)` method that logs out a message with the color `grey`.
   * @ignore
   */
  _defineLogMethods() {
    Object.keys(this._logColors).forEach((name) => {
      const fname = name.substr(0, 1).toUpperCase() + name.substr(1);
      this[`_log${fname}`] = (msg) => this._log(msg, this._logColors[name]);
    });
  }
  /**
   * Binds a list of the plugins methods to the instance so they can access it when Webpack
   * invokes them.
   * @ignore
   */
  _bindMethods() {
    [
      'apply',
      '_onAssetsEmitted',
      '_onCompilationStarts',
      '_onCompilationEnds',
    ].forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }
  /**
   * This method is called on the Webpack `after-emit` event, it validates the entry asset set
   * on the plugin constructor, finds a fallback if needed, inform via logging what's doing and
   * saves the absolute path of the file it will use to run the build.
   * @param {Object}   compilation A dictionary Webpack provides with the information of the
   *                               assets it's going to build.
   * @param {Function} callback    A callback function Webpack requires for the method to call
   *                               after it finishes whatever it's doing.
   * @ignore
   */
  _onAssetsEmitted(compilation, callback) {
    if (!this._setup) {
      this._setup = true;
      const entries = Object.keys(compilation.assets)
      .filter((a) => (
        !a.includes('hot-update') &&
        compilation.assets[a].existsAt &&
        compilation.assets[a].existsAt.match(/\.js$/i)
      ));

      this._log();
      if (this._entry && entries.indexOf(this._entry) === -1) {
        this._logError(`The required entry (${this._entry}) doesn't exist`);
        this._entry = null;
        this._logAvailableEntries(entries);
      } else if (!this._entry && entries.length === 1) {
        [this._entry] = entries;
        this._logSuccess(`Using the only available entry: ${this._entry}`);
      } else if (!this._entry && entries.length > 1) {
        [this._entry] = entries;
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
  /**
   * This method is called on the Webpack `compile` event. It checks if the build is running and
   * stops it.
   * @ignore
   */
  _onCompilationStarts() {
    if (this._entry && this._running && this._instance) {
      this._logInfo('Stopping bundle process');
      this._instance.kill();
      this._instance = null;
      this._running = false;
    }
  }
  /**
   * This method is called on the Webpack `done` event and it's in charge of start running the
   * build.
   * @ignore
   */
  _onCompilationEnds() {
    if (this._entry && !this._running) {
      this._instance = fork(this._entryPath);
      this._log();
      this._logSuccess('Starting bundle process');
      this._running = true;
    }
  }
  /**
   * This is a utility method used when validating the assets. If the plugin needs to fallback
   * because no entry was specified or the one specified doesn't exist, the plugin uses this
   * method to log all available entries for the developer to choose.
   * @param {Array} entries The list of entries.
   */
  _logAvailableEntries(entries) {
    const list = entries.join(', ');
    this._logInfo(`These are the available entries: ${list}`);
  }
  /**
   * A utility method the plugin uses to log messages with the plugin name as a prefix and an
   * specific color (from the `colors` package).
   * @param {String} msg   The message to log.
   * @param {String} color The name of the color to use. It must be available on the `colors`
   *                       package.
   */
  _log(msg, color) {
    const logMsg = msg ? `[WebpackNodeUtilsRunner] ${msg}` : '';
    const logColor = color || 'white';
    console.log(colors[logColor](logMsg));
  }
}

module.exports = WebpackNodeUtilsRunner;
