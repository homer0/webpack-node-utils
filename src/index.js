/* eslint strict: 0, global-require:0, prefer-template: 0 */

'use strict';

const path = require('path');
const fs = require('fs');
const merge = require('webpack-merge');
const WebpackNodeUtilsRunner = require('./runner');
const rootPath = process.cwd();
/**
 * The module's core: A set of static methods that allows you to manage multiple Webpack
 * configuration files, generate the list of external dependencies from your
 * `package.json`, do dynamic requires on runtime and read files without even knowing
 * where the bundle is located.
 */
class WebpackNodeUtils {
    /**
     * The only thing the class constructor does is throw an error if you try to
     * instantiate the class, since it doesn't have any instance method.
     * @throws {Error} If you try to create an instance.
     * @ignore
     */
    constructor() {
        throw new Error('This class is meant to be used without an instance');
    }
    /**
     * Generate a Webpack configuration object.
     * @example
     * // Let's say you are building a frontend app and a Node app server, your
     * // frontend is called 'front' and your server 'back'.
     * // Then, you have a folder called '.webpack' that has these files:
     * // - front.dev.js
     * // - front.prod.js
     * // - back.dev.js
     * // - back.prod.js
     * //
     * // Now, to get the frontend configuration for production, you can do this:
     * webpackNodeUtils.config('.webpack', 'front', 'prod');
     * // For the development configuration
     * webpackNodeUtils.config('.webpack', 'front', 'dev');
     * // And you probably understand how it would be for the server configurations:
     * webpackNodeUtils.config('.webpack', 'back', 'prod');
     * webpackNodeUtils.config('.webpack', 'back', 'dev');
     * // The advantage of this is that you can have a single 'webpack.config.js' file
     * // on your project, and based on environment variables, you decide which target
     * // gets build:
     * webpackNodeUtils.config('.webpack', process.env.TARGET, process.env.NODE_ENV);
     *
     * @param  {String}   directory The directory where your configurations are located.
     * @param  {String}   target    The name of your configuration.
     * @param  {String}   type      The type or environment of the configuration file.
     * @param  {Boolean}  useHash   Optional. If `true`, it will generate a timestamp
     *                              that you can use as a hash string when generating
     *                              your files.
     * @param  {Object}   params    Optional. A dictionary of parameters that are going
     *                              to be sent to every configuration file.
     * @param  {Function} fn        Optional. All the configuration files, by default,
     *                              export a function that this class is going to call
     *                              in order to get configuration. If you have a file
     *                              that has different variations of that
     *                              configuration, like a commonjs version, you can use
     *                              this parameter to specify the name of the exported
     *                              function that has that configuration.
     * @return {Object} A Webpack configuration object.
     */
    static config(directory, target, type, useHash, params, fn) {
        const hash = useHash ? Date.now() : '';
        const hashStr = useHash ? `.${hash}` : '';
        params = Object.assign({
            hash,
            hashStr,
        }, (params || {}));
        fn = fn || '';

        const configName = `${target}.${type}`;
        return this._loadConfig(directory, configName, params, fn);
    }
    /**
     * This is a utility method for when you are building Node apps using Webpack. By
     * default, Webpack wants to put all your `require`s inside the bundle, but there
     * are some Node libraries that can't work that way, so you have to define them as
     * `commonjs` externals. This method will read your project's `package.json` and
     * define all your production dependencies as externals, so they don't end up on
     * the bundle. Also, you can use the method parameters to define custom externals,
     * dependencies that should be ignored and if the development dependencies should
     * be externals too.
     * @example
     * // Get just the production dependencies as externals
     * webpackNodeUtils.externals();
     * // Add some custom dependencies
     * webpackNodeUtils.externals({
     *     'my-module': './some-path/to/my-module.js',
     * });
     * // Add the development dependencies
     * webpackNodeUtils.externals({}, true);
     * // Set some default dependencies
     * webpackNodeUtils.externals({}, false, ['colors/safe']);
     * // Set some dependencies to ignore
     * webpackNodeUtils.externals({}, false, [], ['node-fetch']);
     *
     * @param  {Object}  extras   Optional. A dictionary with the name and path for a
     *                            custom dependency that you want Webpack to use as
     *                            external, allowing you do a `require` inside the
     *                            bundle in order to access it.
     * @param  {Boolean} addDev   Optional. Whether the `devDependencies` should be
     *                            defined as externals too.
     * @param  {Array}   defaults Optional. A list of dependencies that should be
     *                            defined as externals even if they aren't on your
     *                            `package.json`. For example, you can depend on the
     *                            `colors` module, but on your implementation, you use
     *                            `colors/safe`, so it doesn't define global variables.
     * @param  {Array}   ignore   Optional. A list of dependencies that shouldn't be
     *                            defined as externals, even if they are on your
     *                            `package.json`.
     * @return {Object} A dictionary with the external dependencies. The format Webpack
     * expects is `name: 'commonjs [path|name]` (path for custom dependencies and name
     * for npm dependencies).
     */
    static externals(extras, addDev, defaults, ignore) {
        const result = {};
        const packageJSON = this.require('package.json');
        const deps = Object.keys(packageJSON.dependencies);
        const devDeps = addDev ? Object.keys(packageJSON.devDependencies) : [];

        const defaultsDeps = defaults || [
            'webpack-node-utils',
            'colors/safe',
        ];

        const ignoreDeps = ignore || [
            'normalize.css',
            'font-awesome',
            'react-tap-event-plugin',
        ];

        defaultsDeps.concat(deps).concat(devDeps).forEach((pckg) => {
            if (ignoreDeps.indexOf(pckg) === -1) {
                result[pckg] = `commonjs ${pckg}`;
            }
        });

        if (extras) {
            Object.keys(extras).forEach((name) => {
                result[name] = `commonjs ${extras[name]}`;
            });
        }

        return result;
    }
    /**
     * This is the method you would use on runtime to do a dynamic `require`. Webpack
     * doesn't allow dynamic `require`s on runtime and even if it would, you would need
     * to know where the file is located relative to the bundle path, where this method
     * do the `require` using the project root as the initial path.
     * We aware that we are moving in the direction of `import` instead of `require`,
     * and that `import`s can't be dynamic, but dynamic `require`s are still a useful
     * thing on Node apps.
     * @param  {String} modulePath The path to your module relative to your project
     *                             root directory.
     * @return {*} Whatever the `require` returns.
     */
    static require(modulePath) {
        return require(path.join(rootPath, modulePath));
    }
    /**
     * Similar to the `require` method, this one wraps `fs.readFileSync` so you can read
     * files using paths relative to the project root directory.
     * @param  {String} filePath The path to the file you intend to read, relative to
     *                           your project root directory.
     * @param  {String} encoding Optional. The char encoding you want to use to read
     *                           the file. It's `utf-8` by default.
     * @return {String} The contents of the file.
     */
    static read(filePath, encoding) {
        return fs.readFileSync(
            path.join(rootPath, filePath),
            encoding || 'utf-8'
        );
    }
    /**
     * This is the method that loads the Webpack configuration files. After requiring
     * the file, it calls the function that returns the configuration object and send
     * the custom parameters. If the configuration is meant to be an extension of
     * another configuration, it calls itself in order to get that configuration and
     * then merges both of them.
     * @param  {String}   directory The directory where your configurations are located.
     * @param  {String}   name      The name of the configuration file.
     * @param  {Object}   params    A dictionary of custom parameters that are going to
     *                              be sent to the function that generates the
     *                              configuration object.
     * @param  {Function} fn        Optional. By default, this method uses the default
     *                              function the files export, but if the file has
     *                              multiple variations of the same configuration, this
     *                              will be used to specify the name of the exported
     *                              function that needs to be used.
     * @return {Object} A Webpack configuration object.
     * @ignore
     */
    static _loadConfig(directory, name, params, fn) {
        const configPath = path.join(directory, `${name}.js`);
        const configModule = this.require(configPath);
        let config = fn ? configModule[fn](params) : configModule(params);
        if (config.extends) {
            const baseConfig = this._loadConfig(directory, config.extends, params);
            delete config.extends;
            config = merge(baseConfig, config);
        }

        return config;
    }
}

module.exports = WebpackNodeUtils;
module.exports.WebpackNodeUtilsRunner = WebpackNodeUtilsRunner;
