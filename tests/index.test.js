/* eslint strict: 0, global-require: 0, new-cap: 0 */

jest.unmock('../src/index');
jest.unmock('fs');
const webpackNodeUtils = require('../src/index');
const merge = require('webpack-merge');

merge.mockImplementation((obj1, obj2) => Object.assign({}, obj1, obj2));

describe('webpack-node-utils', () => {
    it('should throw an error if you try to create an instance', () => {
        expect(() => {
            new webpackNodeUtils();
        }).toThrowError('This class is meant to be used without an instance');
    });

    it('should load a basic webpack configuration', () => {
        const config = webpackNodeUtils.config(
            'tests/mocks',
            'server',
            'development'
        );

        expect(merge.mock.calls.length).toBe(0);
        expect(config.name).toBe('server-development');
    });

    it('should load a webpack configuration that extends other file', () => {
        const config = webpackNodeUtils.config(
            'tests/mocks',
            'app',
            'production'
        );

        expect(merge.mock.calls.length).toBe(1);
        expect(config.name).toBe('app-production');
        expect(config.fromBase).toBe(true);
    });

    it('should load a webpack configuration with a special variation', () => {
        const config = webpackNodeUtils.config(
            'tests/mocks',
            'server',
            'development',
            false,
            null,
            'library'
        );

        expect(merge.mock.calls.length).toBe(1);
        expect(config.name).toBe('server-development-commonjs');
        expect(config.fromBase).toBe(true);
    });

    it('should load a webpack configuration with custom parameters', () => {
        const customParams = {
            paramOne: 'charito',
            paramTwo: 25092015,
        };

        const config = webpackNodeUtils.config(
            'tests/mocks',
            'app',
            'production',
            false,
            customParams,
            'custom'
        );

        expect(merge.mock.calls.length).toBe(0);
        expect(config.name).toBe('app-production-custom');
        expect(config.params.paramOne).toBe(customParams.paramOne);
        expect(config.params.paramTwo).toBe(customParams.paramTwo);
    });

    it('should load a webpack configuration with the default parameters', () => {
        const now = Date.now();
        const defaultParams = {
            hash: now,
            hashStr: `.${now}`,
        };

        const config = webpackNodeUtils.config(
            'tests/mocks',
            'app',
            'production',
            true,
            defaultParams,
            'custom'
        );

        expect(merge.mock.calls.length).toBe(0);
        expect(config.name).toBe('app-production-custom');
        expect(config.params).toEqual(defaultParams);
    });

    it('should get the project dependencies as externals', () => {
        const externals = webpackNodeUtils.externals();
        expect(externals).toEqual({
            'colors/safe': 'commonjs colors/safe',
            'webpack-merge': 'commonjs webpack-merge',
            'custom-dep': 'commonjs custom-dep',
            'webpack-node-utils': 'commonjs webpack-node-utils',
        });
    });

    it('should include custom dependencies on the externals', () => {
        const externals = webpackNodeUtils.externals({
            'my-mod': '../modules/my-mod.js',
        });

        expect(externals['my-mod']).toMatch(/commonjs .*?\/my\-mod\.js$/);
    });

    it('should include the dev dependencies on the externals', () => {
        const externals = webpackNodeUtils.externals({}, true);
        expect(externals).toEqual({
            'colors/safe': 'commonjs colors/safe',
            'webpack-merge': 'commonjs webpack-merge',
            'custom-dep': 'commonjs custom-dep',
            'webpack-node-utils': 'commonjs webpack-node-utils',
            'jest-cli': 'commonjs jest-cli',
        });
    });

    it('should include a list of default dependencies on the externals', () => {
        const externals = webpackNodeUtils.externals({}, false, ['some-default']);
        expect(externals['some-default']).toBe('commonjs some-default');
    });

    it('should ignore a list of dependencies on the externals', () => {
        const externals = webpackNodeUtils.externals({}, false, null, ['custom-dep']);
        expect(externals).toEqual({
            'webpack-node-utils': 'commonjs webpack-node-utils',
            'colors/safe': 'commonjs colors/safe',
            'webpack-merge': 'commonjs webpack-merge',
        });
    });

    it('should require a module from the root directory', () => {
        const regularReq = require('./mocks/package');
        const dynamicReq = webpackNodeUtils.require('tests/mocks/package');
        expect(dynamicReq).toEqual(regularReq);
    });

    it('should read a file from the root directory', () => {
        const file = webpackNodeUtils.read('tests/mocks/file.txt');
        expect(file.trim()).toBe('hello world');
    });

    it('should read a file with an specific encoding', () => {
        const file = webpackNodeUtils.read('tests/mocks/file.txt', 'utf8');
        expect(file.trim()).toBe('hello world');
    });
});
