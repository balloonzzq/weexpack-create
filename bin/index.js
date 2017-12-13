'use strict';

/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var path = require('path');
var fs = require('fs-extra');
var Q = require('q');
var shell = require('shelljs');
var chalk = require('chalk');

var childProcess = require('child_process');

var validateIdentifier = require('valid-identifier');
var WeexpackCommon = require('weexpack-common');
var WeexpackError = WeexpackCommon.CordovaError;
var WeexpackLogger = WeexpackCommon.CordovaLogger.get();
var events = WeexpackCommon.events;

/**
 * @desc Sets up to forward events to another instance, or log console.
 * This will make the create internal events visible outside
 * @param  {EventEmitter} externalEventEmitter An EventEmitter instance that will be used for
 * logging purposes. If no EventEmitter provided, all events will be logged to console
 * @return {EventEmitter} 
 */
var setupEvents = function setupEvents(externalEventEmitter) {
  if (externalEventEmitter) {
    // This will make the platform internal events visible outside
    events.forwardEventsTo(externalEventEmitter);
  }
  // There is no logger if external emitter is not present,
  // so attach a console logger
  else {
      WeexpackLogger.subscribe(events);
    }
  return events;
};
/**
 * @desc Copies template files, and directories into a weex project directory.
 * @param {string} templateDir - Template directory
 * @param {string} projectDir - Project directory
 * @param {boolean} isSubDir - boolean is true if template has subdirectory structure
 */
var copyTemplateFiles = function copyTemplateFiles(templateDir, projectDir, isSubDir) {
  var copyPath = void 0;
  var templateFiles = void 0; // Current file
  templateFiles = fs.readdirSync(templateDir);
  // Remove directories, and files that are unwanted
  if (!isSubDir) {
    var excludes = ['dist', 'npm-debug.log', '.git', '.DS_Store', '.temp', 'node_modules', 'hooks', 'plugins/plugin.js', 'platform/android', 'platform/ios', 'web/build'];
    templateFiles = templateFiles.filter(function (value) {
      return excludes.indexOf(value) < 0;
    });
  }
  // Copy each template file after filters
  for (var i = 0; i < templateFiles.length; i++) {
    copyPath = path.resolve(templateDir, templateFiles[i]);
    shell.cp('-R', copyPath, projectDir);
  }
  events.emit('log', 'Create weex project successful.');
};
/**
 * @desc check the diretory is empty or not.
 * @param {string} dir
 */
var isEmptyDir = function isEmptyDir(dir) {
  var contents = fs.readdirSync(dir);
  if (contents.length === 0) {
    return true;
  }
  return false;
};
/**
 * @desc excecute command on `cwd`.
 * @param {string} command 
 * @param {string} cwd 
 * @param {boolean} quiet 
 */
var exec = function exec(command, cwd, quiet) {
  return new Promise(function (resolve, reject) {
    try {
      var child = childProcess.exec(command, { cwd: cwd, encoding: 'utf8' }, function () {
        resolve();
      });
      if (!quiet) {
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
      }
    } catch (e) {
      console.error('execute command failed :', command);
      reject(e);
    }
  });
};

/**
 * @desc check the diretory is empty or not.
 * @param {string} dir - directory where the project will be created. Required.
 * @param {string} optionalId - app id. Required (but be "undefined")
 * @param {string} optionalName - app name. Required (but can be "undefined"). 
 * @param {object|string} cfg - extra config to be saved in .cordova/config.json Required (but can be "{}").
 * @param {object} extEvents - An EventEmitter instance that will be used for logging purposes. Required (but can be "undefined"). 
 * @param {boolean} autoInstall - auto install npm packages in project or not.
 */
module.exports = function (dir, optionalId, optionalName, cfg, extEvents, autoInstall) {
  return Q.fcall(function () {
    events = setupEvents(extEvents);
    if (!dir) {
      throw new WeexpackError('Directory not specified. See `weexpack --help`.');
    }
    if (!cfg) {
      throw new WeexpackError('Must provide a project configuration.');
    } else if (typeof cfg === 'string') {
      cfg = JSON.parse(cfg);
    }
    if (optionalId) {
      cfg.id = optionalId;
    }
    if (optionalName) {
      cfg.name = optionalName;
    }
    // Make absolute.
    dir = path.resolve(dir);
    if (fs.existsSync(dir) && !isEmptyDir(dir)) {
      throw new WeexpackError('Path already exists and is not empty: ' + dir);
    }
    if (cfg.id && !validateIdentifier(cfg.id)) {
      throw new WeexpackError('App id contains a reserved word, or is not a valid identifier.');
    }
  }).then(function () {
    // Ready to start!
    events.emit('log', 'Creating a new weex project.');
    // Todo: maybe you can write some weex config here.
  }).then(function () {
    var templateDir = path.join(__dirname, '../templates');
    var dirAlreadyExisted = fs.existsSync(dir);
    // If diretory is not existed, create it.
    if (!dirAlreadyExisted) {
      fs.mkdirSync(dir);
    }
    // Get the file from local diretory.
    copyTemplateFiles(templateDir, dir);
  }).then(function () {
    if (autoInstall) {
      console.log('> ' + chalk.green('Installing project dependencies ...'));
      events.emit('log', 'Installing npm packages in project.');
      exec('npm install', dir, false).then(function () {
        console.log('> ' + chalk.green('Initialization finished!') + '\n');
        console.log('To get started:\n');
        console.log(chalk.yellow('cd ' + dir));
        console.log(chalk.yellow('npm start'));
        console.log('\nDocumentation can be found at https://github.com/weexteam/weexpack-create');
        events.emit('log', 'Already install npm packages in project.');
      });
    }
  });
};