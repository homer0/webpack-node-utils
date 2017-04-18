/* eslint no-console: 0 */

'use strict';

jest.unmock('../src/runner');
jest.mock('child_process');
const WebpackNodeUtilsRunner = require('../src/runner');
const FakeCompiler = require('./mocks/compiler');
const fork = require('child_process').fork;
const originalLog = console.log;
require('jasmine-expect');

const forkKill = jest.fn();
fork.mockImplementation(() => ({
    kill: forkKill,
}));

const getLogMock = () => {
    const mock = jest.fn();
    spyOn(console, 'log').and.callFake(mock);
    return mock;
};

describe('webpack-node-utils-runner', () => {
    afterEach(() => {
        console.log = originalLog;
        forkKill.mockClear();
        fork.mockClear();
    });

    it('should return an instance of WebpackNodeUtilsRunner', () => {
        const sub = new WebpackNodeUtilsRunner();
        expect(sub instanceof WebpackNodeUtilsRunner).toBeTrue();
    });

    it('should add the callbacks to the compiler', () => {
        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner();
        expect(compiler.callbacks['after-emit']).toBeUndefined();
        expect(compiler.callbacks.compile).toBeUndefined();
        expect(compiler.callbacks.done).toBeUndefined();
        sub.apply(compiler);
        expect(compiler.callbacks['after-emit']).toBeFunction();
        expect(compiler.callbacks.compile).toBeFunction();
        expect(compiler.callbacks.done).toBeFunction();
    });

    it('should validate the existence of the entry on compilation time', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                backend: {
                    existsAt: './backend.js',
                },
                app: {
                    existsAt: './app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);

        expect(log.mock.calls.length).toBe(3);
        expect(log.mock.calls[0][0]).toBeEmptyString();
        expect(log.mock.calls[1][0]).toContain(`Using the following entry: ${entry}`);
        expect(log.mock.calls[2][0]).toContain('Entry file:');

        expect(callback.mock.calls.length).toBe(1);
    });

    it('shouldn\'t be able to find a valid entry on compilation time', () => {
        const entry = 'random';
        const compilation = {
            assets: {
                backend: {
                    existsAt: './backend.js',
                },
                app: {
                    existsAt: './app.js',
                },
            },
        };
        const assetsList = Object.keys(compilation.assets).join(', ');

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);

        expect(log.mock.calls.length).toBe(3);
        expect(log.mock.calls[0][0]).toBeEmptyString();
        expect(log.mock.calls[1][0]).toContain(`The required entry (${entry}) doesn\'t exist`);
        expect(log.mock.calls[2][0]).toContain(`These are the available entries: ${assetsList}`);
        expect(callback.mock.calls.length).toBe(1);
    });

    it('should use the only available entry if the list only contains one item', () => {
        const compilation = {
            assets: {
                backend: {
                    existsAt: './backend.js',
                },
            },
        };
        const entry = Object.keys(compilation.assets)[0];

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner();
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        expect(log.mock.calls[0][0]).toBeEmptyString();
        expect(log.mock.calls[1][0]).toContain(`Using the only available entry: ${entry}`);
        expect(log.mock.calls[2][0]).toContain('Entry file:');

        expect(callback.mock.calls.length).toBe(1);
    });

    it('should use the first entry if there wasn\'t one set and list has more than one', () => {
        const compilation = {
            assets: {
                backend: {
                    existsAt: './backend.js',
                },
                app: {
                    existsAt: './app.js',
                },
            },
        };
        const entry = Object.keys(compilation.assets)[0];
        const assetsList = Object.keys(compilation.assets).join(', ');

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner();
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);

        expect(log.mock.calls.length).toBe(4);
        expect(log.mock.calls[0][0]).toBeEmptyString();
        expect(log.mock.calls[1][0]).toContain(`Doing fallback to the first entry: ${entry}`);
        expect(log.mock.calls[2][0]).toContain(`These are the available entries: ${assetsList}`);
        expect(log.mock.calls[3][0]).toContain('Entry file:');
        expect(callback.mock.calls.length).toBe(1);
    });

    it('should\'t try to find the entry more than once', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: './app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);

        expect(log.mock.calls.length).toBe(3);
        expect(log.mock.calls[0][0]).toBeEmptyString();
        expect(log.mock.calls[1][0]).toContain(`Using the following entry: ${entry}`);
        expect(log.mock.calls[2][0]).toContain('Entry file:');
        expect(callback.mock.calls.length).toBe(1);

        compiler.trigger('after-emit', [compilation, callback]);
        expect(log.mock.calls.length).toBe(3);
        expect(callback.mock.calls.length).toBe(2);
    });

    it('should run the build when compilation ends', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: 'app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        compiler.trigger('done');

        expect(fork.mock.calls.length).toBe(1);

        expect(log.mock.calls.length).toBe(5);
        expect(log.mock.calls[4][0]).toContain('Starting bundle process');
        expect(callback.mock.calls.length).toBe(1);
    });

    it('should stop the build when compilation starts', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: 'app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        compiler.trigger('done');
        compiler.trigger('compile');

        expect(fork.mock.calls.length).toBe(1);
        expect(forkKill.mock.calls.length).toBe(1);

        expect(log.mock.calls.length).toBe(6);
        expect(log.mock.calls[4][0]).toContain('Starting bundle process');
        expect(log.mock.calls[5][0]).toContain('Stopping bundle process');
        expect(callback.mock.calls.length).toBe(1);
    });

    it('should restart the build when it changes', () => {
        const numberOfChanges = 3;
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: 'app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        compiler.trigger('done');
        for (let i = 0; i < numberOfChanges; i++) {
            compiler.trigger('compile');
            compiler.trigger('done');
        }

        const baseLogCalls = 5;
        const logsForCall = 3;
        expect(log.mock.calls.length).toBe(baseLogCalls + (numberOfChanges * logsForCall));
        for (let i = baseLogCalls; i < log.mock.calls.length; i += logsForCall) {
            expect(log.mock.calls[i][0]).toContain('Stopping bundle process');
            expect(log.mock.calls[i + 1][0]).toBeEmptyString();
            expect(log.mock.calls[i + 2][0]).toContain('Starting bundle process');
        }

        expect(callback.mock.calls.length).toBe(1);
    });

    it('shouldn\'t stop the build if it\'s not running', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: 'app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        compiler.trigger('compile');

        expect(log.mock.calls.length).toBe(3);
        expect(forkKill.mock.calls.length).toBe(0);
        expect(callback.mock.calls.length).toBe(1);
    });

    it('shouldn\'t start the build if it\'s already running', () => {
        const entry = 'app';
        const compilation = {
            assets: {
                app: {
                    existsAt: 'app.js',
                },
            },
        };

        const compiler = new FakeCompiler();
        const sub = new WebpackNodeUtilsRunner(entry);
        const callback = jest.fn();
        const log = getLogMock();

        sub.apply(compiler);
        compiler.trigger('after-emit', [compilation, callback]);
        compiler.trigger('done');
        compiler.trigger('done');

        expect(log.mock.calls.length).toBe(5);
        expect(fork.mock.calls.length).toBe(1);
        expect(callback.mock.calls.length).toBe(1);
    });
});
