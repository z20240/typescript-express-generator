#!/usr/bin/env node

const ejs = require('ejs');
const fs = require('fs');
const minimatch = require('minimatch');
const mkdirp = require('mkdirp');
const path = require('path');
const program = require('commander');
const sortedObject = require('sorted-object');
const util = require('util');
const { execSync } = require('child_process');

const inquirer = require('inquirer');

const MODE_0666 = parseInt('0666', 8);
const MODE_0755 = parseInt('0755', 8);
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');
const VERSION = require('../package').version;

const _exit = process.exit;

// Re-assign process.exit because of commander
// TODO: Switch to a different command framework
process.exit = exit;

// CLI

around(program, 'optionMissingArgument', function (fn, args) {
  program.outputHelp();
  fn.apply(this, args);
  return { args: [], unknown: [] };
});

before(program, 'outputHelp', function () {
  // track if help was shown for unknown option
  this._helpShown = true;
});

before(program, 'unknownOption', function () {
  // allow unknown options if help was shown, to prevent trailing error
  this._allowUnknownOption = this._helpShown;

  // show help if not yet shown
  if (!this._helpShown) {
    program.outputHelp();
  }
});

program
  .name('express')
  .version(VERSION, '    --version')
  .usage('[options] [dir]')
  .option('-e, --ejs', 'add ejs engine support', renamedOption('--ejs', '--view=ejs'))
  .option('    --pug', 'add pug engine support', renamedOption('--pug', '--view=pug'))
  .option('    --hbs', 'add handlebars engine support', renamedOption('--hbs', '--view=hbs'))
  .option('-H, --hogan', 'add hogan.js engine support', renamedOption('--hogan', '--view=hogan'))
  .option('-v, --view <engine>', 'add view <engine> support (dust|ejs|hbs|hjs|jade|pug|twig|vash) (defaults to jade)')
  .option('    --no-view', 'use static html instead of view engine')
  .option('-c, --css <engine>', 'add stylesheet <engine> support (less|stylus|compass|sass) (defaults to plain css)')
  .option('    --git', 'add .gitignore')
  .option('-f, --force', 'force on non-empty directory')
  .parse(process.argv);

if (!exit.exited) {
  main();
}

/**
 * Install an around function; AOP.
 */

function around(obj, method, fn) {
  const old = obj[method];

  obj[method] = function () {
    const args = new Array(arguments.length);
    for (let i = 0; i < args.length; i++) args[i] = arguments[i];
    return fn.call(this, old, args);
  };
}

/**
 * Install a before function; AOP.
 */

function before(obj, method, fn) {
  const old = obj[method];

  obj[method] = function () {
    fn.call(this);
    old.apply(this, arguments);
  };
}

/**
 * Prompt for confirmation on STDOUT/STDIN
 */

const confirm = async (msg) => {
  const answer = await inquirer.prompt([
    {
      name: 'yon',
      type: 'input',
      message: msg,
      filter: (val) => val.toLowerCase()
    }
  ]);

  return answer.yon === 'y';
};

const optionSelector = async ({ name, question, list }) => {
  const answer = await inquirer.prompt([
    {
      name: name,
      type: 'list',
      message: question,
      default: list[0],
      choices: list
    }
  ]);

  return answer;
};

/**
 * Copy file from template directory.
 * @param {string} from
 * @param {string} to
 */

function copyTemplate(from, to) {
  write(to, fs.readFileSync(path.join(TEMPLATE_DIR, from), 'utf-8'));
}

/**
 * Copy multiple files from template directory.
 */

function copyTemplateMulti(fromDir, toDir, nameGlob) {
  fs.readdirSync(path.join(TEMPLATE_DIR, fromDir))
    .filter(minimatch.filter(nameGlob, { matchBase: true }))
    .forEach(function (name) {
      copyTemplate(path.join(fromDir, name), path.join(toDir, name));
    });
}

/**
 * Create application at the given directory.
 *
 * @param {string} name
 * @param {string} dir
 */

async function createApplication(name, dir) {
  console.log();

  // Package
  let pkg = require('../templates/config/package.json');
  pkg = { name, ...pkg };

  // tsconfig
  let tsconfig = require('../templates/config/tsconfig.json');
  const tsconfigBuild = require('../templates/config/tsconfig.build.json');

  // JavaScript
  const app = loadTemplate('ts/app.ts');
  const www = loadTemplate('ts/www.ts');

  // App name
  www.locals.name = name;

  // App modules
  app.locals.localModules = Object.create(null);
  app.locals.modules = Object.create(null);
  app.locals.mounts = [];
  app.locals.uses = [];

  // Request logger
  app.locals.modules.logger = 'morgan';
  app.locals.uses.push("logger('dev')");
  pkg.dependencies.morgan = '~1.9.1';

  // Body parsers
  app.locals.uses.push('express.json()');
  app.locals.uses.push('express.urlencoded({ extended: false })');

  // Cookie parser
  app.locals.modules.cookieParser = 'cookie-parser';
  app.locals.uses.push('cookieParser()');
  pkg.dependencies['cookie-parser'] = '~1.4.4';

  if (dir !== '.') mkdir(dir, '.');

  mkdir(dir, 'src');
  mkdir(dir, 'src/public');
  mkdir(dir, 'src/public/javascripts');
  mkdir(dir, 'src/public/images');
  mkdir(dir, 'src/public/stylesheets');

  // Copy route templates
  mkdir(dir, 'src');
  mkdir(dir, 'src/routes');
  copyTemplateMulti('ts/routes', dir + '/src/routes', '*.ts');

  // Copy utils templates
  mkdir(dir, 'src');
  mkdir(dir, 'src/utils');
  copyTemplateMulti('ts/utils', dir + '/src/utils', '*.ts');

  if (program.view) {
    // Copy view templates (if needed)
    mkdir(dir, 'src');
    mkdir(dir, 'src/views');
    pkg.dependencies['http-errors'] = '~1.6.3';
    switch (program.view) {
      case 'dust':
        copyTemplateMulti('views', dir + '/src/views', '*.dust');
        break;
      case 'ejs':
        copyTemplateMulti('views', dir + '/src/views', '*.ejs');
        break;
      case 'hbs':
        copyTemplateMulti('views', dir + '/src/views', '*.hbs');
        break;
      case 'hjs':
        copyTemplateMulti('views', dir + '/src/views', '*.hjs');
        break;
      case 'jade':
        copyTemplateMulti('views', dir + '/src/views', '*.jade');
        break;
      case 'pug':
        copyTemplateMulti('views', dir + '/src/views', '*.pug');
        break;
      case 'twig':
        copyTemplateMulti('views', dir + '/src/views', '*.twig');
        break;
      case 'vash':
        copyTemplateMulti('views', dir + '/src/views', '*.vash');
        break;
      default:
        // Copy extra public files
        copyTemplate('ts/index.html', path.join(dir, 'src/public/index.html'));
    }
  } else {
    // Copy extra public files
    copyTemplate('ts/index.html', path.join(dir, 'src/public/index.html'));
  }

  // Copy css templates
  switch (program.css) {
    case 'less':
      copyTemplateMulti('css', dir + '/src/public/stylesheets', '*.less');
      break;
    case 'stylus':
      copyTemplateMulti('css', dir + '/src/public/stylesheets', '*.styl');
      break;
    case 'compass':
      copyTemplateMulti('css', dir + '/src/public/stylesheets', '*.scss');
      break;
    case 'sass':
      copyTemplateMulti('css', dir + '/src/public/stylesheets', '*.sass');
      break;
    default:
      copyTemplateMulti('css', dir + '/src/public/stylesheets', '*.css');
      break;
  }

  // CSS Engine support
  switch (program.css) {
    case 'compass':
      app.locals.modules.compass = 'node-compass';
      app.locals.uses.push("compass({ mode: 'expanded' })");
      pkg.dependencies['node-compass'] = '0.2.3';
      break;
    case 'less':
      app.locals.modules.lessMiddleware = 'less-middleware';
      app.locals.uses.push("lessMiddleware(path.join(__dirname, 'public'))");
      pkg.dependencies['less-middleware'] = '~2.2.1';
      break;
    case 'sass':
      app.locals.modules.sassMiddleware = 'node-sass-middleware';
      app.locals.uses.push(
        "sassMiddleware({\n  src: path.join(__dirname, 'public'),\n  dest: path.join(__dirname, 'public'),\n  indentedSyntax: true, // true = .sass and false = .scss\n  sourceMap: true\n})"
      );
      pkg.dependencies['node-sass-middleware'] = '0.11.0';
      break;
    case 'stylus':
      app.locals.modules.stylus = 'stylus';
      app.locals.uses.push("stylus.middleware(path.join(__dirname, 'public'))");
      pkg.dependencies['stylus'] = '0.54.5';
      break;
  }

  // Index router mount
  app.locals.localModules.indexRouter = './routes/index';
  app.locals.mounts.push({ path: '/', code: 'indexRouter' });

  // User router mount
  app.locals.localModules.usersRouter = './routes/users';
  app.locals.mounts.push({ path: '/users', code: 'usersRouter' });

  // Template support
  switch (program.view) {
    case 'dust':
      app.locals.modules.adaro = 'adaro';
      app.locals.view = {
        engine: 'dust',
        render: 'adaro.dust()'
      };
      pkg.dependencies.adaro = '~1.0.4';
      break;
    case 'ejs':
      app.locals.view = { engine: 'ejs' };
      pkg.dependencies.ejs = '~2.6.1';
      break;
    case 'hbs':
      app.locals.view = { engine: 'hbs' };
      pkg.dependencies.hbs = '~4.0.4';
      break;
    case 'hjs':
      app.locals.view = { engine: 'hjs' };
      pkg.dependencies.hjs = '~0.0.6';
      break;
    case 'jade':
      app.locals.view = { engine: 'jade' };
      pkg.dependencies.jade = '~1.11.0';
      break;
    case 'pug':
      app.locals.view = { engine: 'pug' };
      pkg.dependencies.pug = '2.0.0-beta11';
      break;
    case 'twig':
      app.locals.view = { engine: 'twig' };
      pkg.dependencies.twig = '~0.10.3';
      break;
    case 'vash':
      app.locals.view = { engine: 'vash' };
      pkg.dependencies.vash = '~0.12.6';
      break;
    default:
      app.locals.view = false;
      break;
  }

  // Static files
  app.locals.uses.push("express.static(path.join(__dirname, 'public'))");

  // if (program.git) {
  if (dir !== '.') execSync(`cd ${dir} && git init`, { stdio: 'inherit' });
  copyTemplate('ts/gitignore', path.join(dir, '.gitignore'));
  // }

  // sort dependencies like npm(1)
  pkg.dependencies = sortedObject(pkg.dependencies);

  // write typescript
  const optionName = 'tsverb';
  const answer = await optionSelector({
    name: optionName,
    question: 'which tsconfig version you want to use ?',
    list: [
      'recommended',
      'create-react-app',
      'cypress',
      'deno',
      'docusaurus',
      'next',
      'node10',
      'node12',
      'node14',
      'node16',
      'nuxt',
      'react-native',
      'svelte'
    ]
  });

  const standerTsconfig = `@tsconfig/${answer[optionName]}`;
  pkg.devDependencies[standerTsconfig] = '^1.0.0';
  tsconfig = { extends: `${standerTsconfig}/tsconfig.json`, ...tsconfig };

  // write files
  write(path.join(dir, 'src/app.ts'), app.render());
  write(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  write(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
  write(path.join(dir, 'tsconfig.build.json'), JSON.stringify(tsconfigBuild, null, 2) + '\n');
  mkdir(dir, 'bin');
  write(path.join(dir, 'bin/www.ts'), www.render(), MODE_0755);
  mkdir(dir, 'etc');
  copyTemplate(path.join('etc', 'build.sh'), path.join(dir, 'etc', 'build.sh'));

  // check if win32
  const prompt = launchedFromCmd() ? '>' : '$';

  console.log();
  console.log('   install dependencies:');
  console.log('     %s npm install', prompt);
  console.log();
  console.log('   run the app:');

  if (launchedFromCmd()) {
    console.log('     %s SET DEBUG=%s:* & npm start', prompt, name);
  } else {
    console.log('     %s DEBUG=%s:* npm start', prompt, name);
  }

  console.log();
}

/**
 * Create an app name from a directory path, fitting npm naming requirements.
 *
 * @param {String} pathName
 */

function createAppName(pathName) {
  return path
    .basename(pathName)
    .replace(/[^A-Za-z0-9.-]+/g, '-')
    .replace(/^[-_.]+|-+$/g, '')
    .toLowerCase();
}

/**
 * Check if the given directory `dir` is empty.
 *
 * @param {String} dir
 * @param {Function} fn
 */

async function emptyDirectory(dir, fn) {
  await fs.readdir(dir, async function (err, files) {
    if (err && err.code !== 'ENOENT') throw err;
    await fn(!files || !files.length);
  });
}

/**
 * Graceful exit for async STDIO
 */

function exit(code) {
  // flush output for Node.js Windows pipe bug
  // https://github.com/joyent/node/issues/6247 is just one bug example
  // https://github.com/visionmedia/mocha/issues/333 has a good discussion
  function done() {
    if (!draining--) _exit(code);
  }

  let draining = 0;
  const streams = [process.stdout, process.stderr];

  exit.exited = true;

  streams.forEach(function (stream) {
    // submit empty write request and wait for completion
    draining += 1;
    stream.write('', done);
  });

  done();
}

/**
 * Determine if launched from cmd.exe
 */

function launchedFromCmd() {
  return process.platform === 'win32' && process.env._ === undefined;
}

/**
 * Load template file.
 */

function loadTemplate(name) {
  const contents = fs.readFileSync(path.join(__dirname, '..', 'templates', name + '.ejs'), 'utf-8');
  const locals = Object.create(null);

  function render() {
    return ejs.render(contents, locals, {
      escape: util.inspect
    });
  }

  return {
    locals: locals,
    render: render
  };
}

/**
 * Main program.
 */

async function main() {
  // Path
  const destinationPath = program.args.shift() || '.';

  // App name
  const appName = createAppName(path.resolve(destinationPath)) || 'hello-world';

  // View engine
  if (program.view === true) {
    if (program.ejs) program.view = 'ejs';
    if (program.hbs) program.view = 'hbs';
    if (program.hogan) program.view = 'hjs';
    if (program.pug) program.view = 'pug';
    // Default view engine

    warning(
      'the default view engine will not be jade in future releases\n' +
        "use `--view=jade' or `--help' for additional options"
    );
    program.view = 'jade';
  }

  // Generate application
  await emptyDirectory(destinationPath, async function (empty) {
    if (empty || program.force) {
      await createApplication(appName, destinationPath);
      return;
    }

    const ok = await confirm('destination is not empty, continue? [y/N] ');

    if (ok) {
      await createApplication(appName, destinationPath);
      return;
    }

    console.error('aborting');
    exit(1);
  });
}

/**
 * Make the given dir relative to base.
 *
 * @param {string} base
 * @param {string} dir
 */

function mkdir(base, dir) {
  const loc = path.join(base, dir);

  console.log('   \x1b[36mcreate\x1b[0m : ' + loc + path.sep);
  mkdirp.sync(loc, MODE_0755);
}

/**
 * Generate a callback function for commander to warn about renamed option.
 *
 * @param {String} originalName
 * @param {String} newName
 */

function renamedOption(originalName, newName) {
  return function (val) {
    warning(util.format("option `%s' has been renamed to `%s'", originalName, newName));
    return val;
  };
}

/**
 * Display a warning similar to how errors are displayed by commander.
 *
 * @param {String} message
 */

function warning(message) {
  console.error();
  message.split('\n').forEach(function (line) {
    console.error('  warning: %s', line);
  });
  console.error();
}

/**
 * echo str > file.
 *
 * @param {String} file
 * @param {String} str
 */

function write(file, str, mode) {
  fs.writeFileSync(file, str, { mode: mode || MODE_0666 });
  console.log('   \x1b[36mcreate\x1b[0m : ' + file);
}
