# Webpack Node Utils

[![Build Status](https://travis-ci.org/homer0/webpack-node-utils.svg?branch=master)](https://travis-ci.org/homer0/webpack-node-utils) [![Coverage Status](https://coveralls.io/repos/homer0/webpack-node-utils/badge.svg?branch=master&service=github)](https://coveralls.io/github/homer0/webpack-node-utils?branch=master) [![Documentation Status](https://doc.esdoc.org/github.com/homer0/webpack-node-utils/badge.svg)](https://doc.esdoc.org/github.com/homer0/webpack-node-utils/) [![Dependencies status](https://david-dm.org/homer0/webpack-node-utils.svg)](https://david-dm.org/homer0/webpack-node-utils) [![Dev dependencies status](https://david-dm.org/homer0/webpack-node-utils/dev-status.svg)](https://david-dm.org/homer0/webpack-node-utils#info=devDependencies)

A set of utility methods that for a better experience building Node applications using [Webpack](https://webpack.github.io).

## The motivation

The moment we started building universal applications we found a few issues that complicated the process a little bit:

- Production and development configurations for both the backend and the frontend... a lot of repeated code and a lot to keep track of.
- No dynamic `require`.
- The relative paths we needed to read some files on runtime changed because the bundle wasn't located on the same place the module that needed to read was.
- We had to define the production dependencies as `externals`, otherwise Webpack would try to put everything on the bundle.
- Because I needed the backend build to run a server, I couldn't use `--watch` on the same tab.

So we built workarounds, but those workarounds were attached to the project where they were created, so moving them involved a lot of copy&paste, and for something this generic, having them on a module made more sense.

## Information

| -            | -                                                                  |
|--------------|--------------------------------------------------------------------|
| Package      | webpack-node-utils                                                 |
| Description  | A set of utility methods to help you build Node apps with Webpack. |
| Node Version | >= v6.0.0                                                          |

## Usage

### Handling multiple Webpack configurations for multiple apps

Let's start by making clear that when you build an app with Webpack, you usually have two configurations: One that may have development plugins, like loggers, hot reload, and such; and one for production, where you optimize your code, uglify it and maybe even compress it.

Now, let's say you have a universal app that has both backend and frontend code, you probably have four different files or maybe just two where you validate the `NODE_ENV` and `export` the configuration for the environment you need. Based on what you have, this may lead you to one of these problems:

- Multiple files: A lot of repeated code. If you want to add a new loader or change something shared between those configs, you'll need to go one by one and change it.
- Validate the `NODE_ENV`: This one is simple, you'll probably end up with a huge file, not easy to read and understand.

Ok, this module tries to simplify all the above... **kind of using both approaches**:

- You'll have multiple files for app and environment, repeating code where's necessary, just for sake of clarity.
- The environment check will kind of happen inside module.

**We'll review this with an example/tutorial:**

First, create a directory to store your Webpack configuration, we usually use `.webpack`. Then, we are going to create a base configuration that all the other can _extend_. This will allow you to have all the shared code in one place:

```js
// File: ./.webpack/base.js
module.exports = () => ({
    module: {
        loaders: [...],
    },
    resolve: ['js', 'jsx', 'json'],
});
```

Take a look, we only took things that weren't really specific to the configurations themselves. You would want to just move the shared code, not remove all repeated code, is not the same: The loaders are usually always the same, so that's ok, but if you put in here `output.filename`, that wouldn't be ok, because it takes clarity of the `output` configuration, and you would have to know that part of that configuration is on another file.

Moving along, you are probably wondering why the file is not exporting an `Object`, but instead is exporting a `Function`? Well, that will get explained when you see how the configuration is invoked.

Now that we have the base configuration, let's add the ones for the frontend, for both production and development:

```js
// File: ./.webpack/frontend.dev.js
module.exports = () => ({
    extends: 'base',
    entry: {...},
    output: {...},
    plugins: {...},
});

// File: ./.webpack/frontend.prod.js
module.exports = () => ({
    extends: 'base',
    entry: {...},
    output: {...},
    plugins: {...},
});
```

They look the same, right? That's the idea, they only change where they need to change, and the shared settings are on the base configuration, which they both extend.

For the backend, it's the same, but for this example, let's say you are using [Express](https://expressjs.com/) for your server and you want to use [supertest](https://github.com/visionmedia/supertest) for integration tests. The thing is that Webpack, by default, generates a bundle that auto executes itself, and that can't be accessed from the outside, and for Supertest, you need to be able to start and stop the server between suites.

You probably know this, but in case you don't, you can specify on your Webpack configuration that the bundle is a `commonjs` library, but wait... does that means that if I want to test both the production and the development server I would need an extra configuration for each one? Yes, and No. Webpack Node Utils allows you to have use variations of the same configuration on a very simple way:

```js
// File: ./.webpack/server.dev.js
const defaultSetup = module.exports = () => ({
    extends: 'base',
    entry: {...},
    output: {...},
    plugins: {...},
});

module.exports.library = (params) => {
    const config = defaultSetup(params);
    config.output.libraryTarget = 'commonjs2';
    return config;
};

// And yes, it would be the same for `server.prod.js`.
```

You define your configuration, export it and at the same time you save it on variable, then you export another function, which would be your variation, in this case, a `commonjs` library. The variation gets the configuration you export by default, makes a small change on the `output` and return it like nothing happened.

We know, you are wondering what the `params` argument is, right? We are almost there.

So, **five files**, **four build types** and **two extra variations**, but... how the hell do you use it?

> In this example, we are going to use only one `webpack.config.js` file, but you can use one per target if you want.

```js
// File: ./webpack.config.js
const webpackNodeUtils = require('webpack-node-utils');

// The directory where the configuration files are.
const directory = '.webpack';
// Use a environment variable to detect the target
const target = process.env.BUILD_TARGET || 'frontend';
// Use the `NODE_ENV` environment variable to detect the build type.
const type = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
// And another environment variable to detect the variation
const variation = process.env.BUILD_AS_LIB === 'true' ? 'library' : '';
// Should the module add a timestamp hash on the parameters so I can use when creating the files?
const createHash = type === 'prod';

// Define some parameters you would need access on your configurations
const params = {
    HTMLTitle: 'Hello world!',
    outputDir: './dist/',
};

// Finally, get and export the configuration
module.exports = webpackNodeUtils.config(directory, target, type, createHash, params, variation);
```

One _entry point_, multiple apps, configurations and variations:

```bash
# Build the frontend on development mode
webpack

# Build the frontend on production mode
NODE_ENV=production webpack

# Build the backend on development mode
BUILD_TARGET=backend webpack

# Build the backend on production mode
NODE_ENV=production BUILD_TARGET=backend webpack

# Build the backend on development mode, as a commonjs library
BUILD_AS_LIB=true BUILD_TARGET=backend webpack

# Build the backend on production mode, as a commonjs library
BUILD_AS_LIB=true NODE_ENV=production BUILD_TARGET=backend webpack
```

Simple to read and simple to maintain.

Now, the `params`: There are certain things on the Webpack configurations that are there because a plugin or a setting require them to be there, but in your app structure, they should be on a higher level, like those two on the example:

- `HTMLTitle`: All your frontend builds are going to use the same title, and even if they don't, is something from your app, not related to the building process, but it's needed there so the plugin that generates the HTML needs it.
- `outputDir`: Probably the same for **all your builds**. This is a really important setting of Webpack, it will tell it where to write the files, but at the same time it's part of the structure of your project, so it probably shouldn't be buried and repeated on multiple files.

Those are kind of edge cases, but they exist. What we usually do is create a sort of `config.json` with these higher level settings and then feed them to the configuration objects using the `params` argument.

That's all for **Handling multiple Webpack configurations for multiple apps**, for more information, check the technical documentation.

### Dynamic readFileSync and require on runtime

There are two problems here:

- You can't do dynamic `require` on runtime (`require('config.' + env)`) while using Webpack.
- When reading or requiring files on your app, the relative paths are not the same for the file that does it and for the bundle that runs your app.

The workaround for this are two _proxy methods_ for `require` and for `fs.readFileSync`, they both run from inside this module, and since this module is not inside the bundle, there's no problem with Webpack. Also, these methods use a path relative to your project root path, so you don't have to worry about that either:

**Require a file with a dynamic name on runtime:** `.require()`

On this example, we'll assume you have a set of configuration files on a `config` directory, located on your root path; and we'll create a function to `require` those configurations based on a given _environment_.

```js
const webpackNodeUtils = require('webpack-node-utils');

// Set the function that does the dynamic require.
const getConfigForEnvironment = env => webpackNodeUtils.require('./config/config.' + env);

// require('<root>/config/config.dev')
getConfigForEnvironment('dev');

// require('<root>/config/config.prod')
getConfigForEnvironment('prod');
```

> We aware that we are moving in the direction of `import` instead of `require`, and that `import`s can't be dynamic, but dynamic `require`s are still a useful thing on Node apps.

**Read a file with a dynamic name on runtime:** `.read()`

On this example, we'll assume you have a list of `.csv` files on a `sales` directory, located on your root path; and we'll create a function to read those files based on the name of a month:

```js
const webpackNodeUtils = require('webpack-node-utils');

// Set the function that reads the files
const getCSVByMonth = month => webpackNodeUtils.read('./sales/sales.' + month + '.csv');

// fs.readFileSync('./sales/sales.july.csv', 'utf-8');
getCSVByMonth('july');

// fs.readFileSync('./sales/sales.september.csv', 'utf-8');
getCSVByMonth('september');
```

### Generating external dependencies for your configuration

By default, Webpack reads all the `require`s on your code and tries to put them inside the bundle, but on a Node app, there are some dependencies that you don't want in there, and others that don't even work when inside a bundle.

There are a lot of tutorials out there that show you how to read your `package.json`, get all your dependencies and define them as `externals` on your Webpack configuration. We'll, we decided to wrap that logic inside Webpack Node Utils and add a few other options for you to play with:

- Define custom external dependencies: You can do `require()` inside your code of things that aren't on your `node_modules`.
- Include your `devDependencies`: Sometimes, you have dependencies you need access to when running your app on development mode.
- Set a list of default externals: Some dependencies you need to require them with a _sub path_, and that's not the way they're declared on your `package.json` (For example: You may use the `colors` package by requiring `colors/safe`).
- Set a list of dependencies to ignore

Let's see all of this with a few examples based on this `package.json`:

```json
{
    "dependencies": {
        "jest-cli": "1.0.0",
        "node-fetch": "1.0.0"
    },
    "devDependencies": {
        "webpack": "1.0.0",
        "webpack-middleware": "1.0.0"
    }
}
```

```js
const webpackNodeUtils = require('webpack-node-utils');

// Get all the production dependencies as externals
webpackNodeUtils.externals();
/**
 *  {
 *      'jest-cli': 'commonjs jest-cli',
 *      'node-fetch': 'commonjs node-fetch',
 *  }
 */

// Add a custom dependency
webpackNodeUtils.externals({
    'my-custom-module': 'modules/custom.js'
});
/**
 *  {
 *      'jest-cli': 'commonjs jest-cli',
 *      'node-fetch': 'commonjs node-fetch',
 *      'my-custom-module': 'commonjs <rootDir>/modules/custom.js'
 *  }
 */

// Include the `devDependencies`
webpackNodeUtils.externals({}, true);
/**
 *  {
 *      'jest-cli': 'commonjs jest-cli',
 *      'node-fetch': 'commonjs node-fetch',
 *      'webpack': 'commonjs webpack',
 *      'webpack-middleware': 'commonjs webpack-middleware',
 *  }
 */

// Add `colors/safe` as default
webpackNodeUtils.externals({}, false, ['colors/safe']);
/**
 *  {
 *      'colors/safe': 'commonjs colors/safe',
 *      'jest-cli': 'commonjs jest-cli',
 *      'node-fetch': 'commonjs node-fetch',
 *  }
 */

// Let's ignore `node-fetch` and include it on the bundle
webpackNodeUtils.externals({}, false, [], ['node-fetch']);
/**
 *  {
 *      'jest-cli': 'commonjs jest-cli',
 *  }
 */
```

### Running the backend build with the watch flag

One of the issues we had while building both backend and frontend with Webpack was that we couldn't use the `--watch` flag for the backend without having to open another terminal, because Webpack stops on the watch and whatever comes next doesn't get executed. One of the solutions we tried was to use [nodemon](https://www.npmjs.com/package/nodemon) to watch the backend and restart the necessary task when the files change, but that also means that Webpack needs to be restarted too, which may take a few seconds (more if the task you use is hooked to other things, like cleaning the build folder for example). Now, the magic of Webpack watching the files is that it doesn't need to be restarted and the change happens almost immediately (in most cases :P).

We did some research and we found [start-server-webpack-plugin](https://github.com/ericclemmons/start-server-webpack-plugin), which uses the `cluster` module to start a server when Webpack finishes loading; which is great, but not entirely what we wanted, so we built a small plugin based on that:

`WebpackNodeUtilsRunner` receives an entry name and it takes care of executing the build once Webpack finishes, and if Webpack needs to rebuild, it stops the build process, waits for Webpack to finish again and restart the build.

All you have to do is to include it on your Webpack configuration:

```js
// File: ./.webpack/backend.dev.js
const WebpackNodeUtilsRunner = require('webpack-node-utils').WebpackNodeUtilsRunner;

module.exports = () => ({
    extends: 'base',
    entry: {...},
    output: {...},
    plugins: [
        new WebpackNodeUtilsRunner('your-backend-asset-name'),
    ],
});
```
> Yes, the example uses the syntax we use for handling multiple configurations, but that's not required.

For more information, check the technical documentation.

## Development

Before doing anything, install the repository hooks:

```bash
npm run install-hooks
```

### NPM Tasks

| Task                    | Description                         |
|-------------------------|-------------------------------------|
| `npm run install-hooks` | Install the GIT repository hooks.   |
| `npm test`              | Run the project unit tests.         |
| `npm run lint`          | Lint the project code.              |
| `npm run docs`          | Generate the project documentation. |

### Testing

We use [Jest](https://facebook.github.io/jest/) as test runner. The configuration file is on `./.jestrc`, the tests and mocks are on `./tests` and the script that runs it is on `./utils/scripts/test`.

### Linting

We use [ESlint](http://eslint.org) to validate all our JS code. The configuration file is on `./.eslintrc`, there's also an `./.eslintignore` to ignore some files on the process, and the script that runs it is on `./utils/scripts/lint`.

### Documentation

We use [ESDoc](http://esdoc.org) to generate HTML documentation for the project. The configuration file ion `./.esdocrc` and the script that runs it is on `./utils/scripts/docs`.
