[![Express Logo](https://github.com/z20240/generator/blob/master/assets/express-typescript.png)](https://www.npmjs.com/package/typescript-express-generator)

[Express'](https://www.npmjs.com/package/express) application generator with typescript.

This tools is forked from express-generator and already built in some useful libraries such as `nodemon`, `log4js`, `dotenv` and `git` which is handy for people whom want to build an express project with **typescript**.

All args of express-generator are provided, you can feel free to use it as express-generator as usual.

[![Version][npm-image]][npm-url]
[![Licensee][licensee-image]][npm-url]
[![Express Version][express-version-image]][express-url]
[![Typescript Version][typescript-version-image]][typescript-url]


## Installation

```sh
$ npm install -g typescript-express-generator
```

## Quick Start

The quickest way to get started with express is to utilize the executable `ts-express` to generate an application as shown below:

Create the app:

```bash
$ ts-express --view=ejs your-awesome-project && cd your-awesome-project
```

Install dependencies:

```bash
$ npm install
```

Start your Express.js app at `http://localhost:3000/`:

```bash
$ npm start
```

## Command Line Options

This generator can also be further configured with the following command line flags.

        --version        output the version number
    -e, --ejs            add ejs engine support
        --pug            add pug engine support
        --hbs            add handlebars engine support
    -H, --hogan          add hogan.js engine support
    -v, --view <engine>  add view <engine> support (dust|ejs|hbs|hjs|jade|pug|twig|vash) (defaults to jade)
        --no-view        use static html instead of view engine
    -c, --css <engine>   add stylesheet <engine> support (less|stylus|compass|sass) (defaults to plain css)
    -f, --force          force on non-empty directory
    -h, --help           output usage information


## Change Log

### 2022-04-20
- Add log4js in to template.
- Add git in to template by default.
## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/typescript-express-generator
[licensee-image]: https://img.shields.io/badge/licensee-MIT-green
[typescript-version-image]: https://img.shields.io/badge/typescript-4.4-blue
[express-version-image]: https://img.shields.io/badge/express-4.16-green
[npm-url]: https://npmjs.org/package/typescript-express-generator
[downloads-url]: https://npmjs.org/package/typescript-express-generator
[typescript-url]: https://www.typescriptlang.org/
[express-url]: https://expressjs.com/
