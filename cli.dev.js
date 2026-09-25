/*
Copyright 2025 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var jshcli_Shared = require('./lib/cli.shared.js');

exports = module.exports = {};

exports.DEFAULT_SCRIPT = './app.js';
exports.DEFAULT_WATCH = ['./models', './app.js', './app.config.js', './app.config.local.js'];
exports.DEFAULT_EXCLUDE = ['data', 'public', 'test', 'clientjs'];
exports.DEFAULT_EXT = ['node', 'js', 'json', 'css', 'sql', 'styl'];
//Default watch paths for App Library projects (jsharmony.project.json)
exports.DEFAULT_PROJECT_WATCH = ['./models', './views', './app.config.js', './app.config.local.js', './app.js'];

var RESTART_DELAY_MS = 200;  //Wait for a burst of changes to settle before restarting
var KILL_TIMEOUT_MS = 5000;  //Force-kill the app if it does not exit after SIGTERM
var ALWAYS_EXCLUDE_DIRS = ['node_modules', '.git'];
//Native recursive fs.watch on Linux stops detecting files that are replaced via rename (editor save)
var NATIVE_RECURSIVE_WATCH = (process.platform == 'darwin') || (process.platform == 'win32');

//Get the watch paths defined in the project manifest (dev.watch), or null if not defined
exports.getProjectWatchPaths = function(projectPath, cb /* (watchPaths) */){
  jshcli_Shared.readManifest(path.join(projectPath, 'jsharmony.project.json'), function(err, manifest){
    if(err){
      if(err.code != 'ENOENT') console.log('Error reading jsharmony.project.json: ' + err.toString());
      return cb(null);
    }
    var watchPaths = manifest.dev.watch;
    if(_.isArray(watchPaths)) return cb(watchPaths);
    if(_.isString(watchPaths)) return cb(_.filter(_.map(watchPaths.split(','), _.trim)));
    if(watchPaths) return cb(exports.DEFAULT_PROJECT_WATCH);
    return cb(null);
  });
};

exports.Run = function(params, options, onSuccess){
  if(!onSuccess) onSuccess = function(){};
  options = options || {};
  if(params.WATCH || options.watch) return exports.RunWatch(params, options, onSuccess);

  //Use the project's watch paths, if defined
  exports.getProjectWatchPaths(process.cwd(), function(watchPaths){
    if(watchPaths) options = _.extend({ watch: watchPaths }, options);
    exports.RunWatch(params, options, onSuccess);
  });
};

exports.RunWatch = function(params, options, onSuccess){
  if(!onSuccess) onSuccess = function(){};
  options = _.extend({
    script: params.SCRIPT || exports.DEFAULT_SCRIPT,
    watch: params.WATCH || exports.DEFAULT_WATCH,
    exclude: params.EXCLUDE || exports.DEFAULT_EXCLUDE,
    ext: params.EXT || exports.DEFAULT_EXT,
    delay: RESTART_DELAY_MS,
  }, options);

  var scriptPath = path.resolve(options.script);
  if(!fs.existsSync(scriptPath)){
    console.log('\r\nApp script not found: ' + scriptPath);
    console.log('Run "jsharmony dev" from the jsHarmony project folder, or pass the script path: jsharmony dev [SCRIPT]');
    return;
  }

  var excludePaths = _.map(options.exclude, function(excludePath){ return path.resolve(excludePath); });
  var extensions = _.map(options.ext, function(ext){ return ext.replace(/^\./, '').toLowerCase(); });
  var allExtensions = _.includes(extensions, '*');

  function isExcluded(fpath){
    for(var i=0;i<excludePaths.length;i++){
      var relPath = path.relative(excludePaths[i], fpath);
      if(!relPath || (relPath.split(path.sep)[0] != '..' && !path.isAbsolute(relPath))) return true;
    }
    return false;
  }

  function hasWatchedExtension(fpath){
    if(allExtensions) return true;
    return _.includes(extensions, path.extname(fpath).replace(/^\./, '').toLowerCase());
  }

  //Start the app
  var child = null;
  var restartPending = false;
  var restartTimer = null;
  var killTimer = null;
  var shuttingDown = false;

  function startApp(){
    console.log('>> Starting: node ' + path.relative(process.cwd(), scriptPath));
    child = spawn(process.execPath, [scriptPath], { stdio: 'inherit', cwd: process.cwd() });
    child.on('error', function(err){
      console.log('Error starting app: ' + err.toString());
    });
    child.on('exit', function(code, signal){
      child = null;
      if(killTimer){ clearTimeout(killTimer); killTimer = null; }
      if(shuttingDown) return process.exit(0);
      if(restartPending){
        restartPending = false;
        return startApp();
      }
      console.log('>> App exited ' + (signal ? 'with signal ' + signal : 'with code ' + code) + ' - waiting for changes before restarting');
    });
  }

  function stopApp(){
    if(!child) return false;
    child.kill('SIGTERM');
    if(!killTimer){
      killTimer = setTimeout(function(){
        killTimer = null;
        if(child){
          console.log('>> App did not exit after ' + (KILL_TIMEOUT_MS/1000) + ' seconds, forcing shutdown');
          child.kill('SIGKILL');
        }
      }, KILL_TIMEOUT_MS);
    }
    return true;
  }

  function restartApp(){
    if(shuttingDown) return;
    if(stopApp()) restartPending = true;
    else startApp();
  }

  function onChange(fpath){
    if(isExcluded(fpath)) return;
    if(!hasWatchedExtension(fpath)) return;
    var fstat = null;
    try{ fstat = fs.lstatSync(fpath); } catch(ex) { /* File deleted */ }
    if(fstat && fstat.isDirectory()) return;

    if(!restartTimer) console.log('\r\n>> Change @ ' + (new Date().toString()) + ': ' + path.relative(process.cwd(), fpath));
    clearTimeout(restartTimer);
    restartTimer = setTimeout(function(){
      restartTimer = null;
      restartApp();
    }, options.delay);
  }

  var watchers = [];

  //Watch a directory tree, calling onEvent(fpath) for each change
  function watchDirRecursive(rootPath, onEvent){
    function isSkippedDir(dirPath){
      var relSegments = path.relative(rootPath, dirPath).split(path.sep);
      return !!_.intersection(relSegments, ALWAYS_EXCLUDE_DIRS).length || isExcluded(dirPath);
    }

    if(NATIVE_RECURSIVE_WATCH){
      watchers.push(fs.watch(rootPath, { recursive: true }, function(evt, fname){
        if(!fname) return;
        var fpath = path.join(rootPath, fname.toString());
        if(isSkippedDir(path.dirname(fpath))) return;
        onEvent(fpath);
      }));
      return;
    }

    //Watch each folder individually, and add watchers as new folders are created
    var dirWatchers = {};
    function watchDir(dirPath, isNew){
      if(dirWatchers[dirPath] || isSkippedDir(dirPath)) return;
      var watcher = null;
      try{
        watcher = fs.watch(dirPath, function(evt, fname){
          if(!fname) return;
          var fpath = path.join(dirPath, fname.toString());
          var fstat = null;
          try{ fstat = fs.lstatSync(fpath); } catch(ex) { /* File deleted */ }
          if(fstat && fstat.isDirectory()) watchDir(fpath, true);
          else onEvent(fpath);
        });
      }
      catch(ex){
        if(dirPath == rootPath) throw ex;
        return;
      }
      watcher.on('error', function(){ closeDir(); });
      function closeDir(){
        watcher.close();
        delete dirWatchers[dirPath];
        _.pull(watchers, watcher);
      }
      dirWatchers[dirPath] = watcher;
      watchers.push(watcher);

      var entries = [];
      try{ entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch(ex) { /* Folder deleted */ }
      _.each(entries, function(entry){
        var entryPath = path.join(dirPath, entry.name);
        if(entry.isDirectory()) watchDir(entryPath, isNew);
        else if(isNew) onEvent(entryPath); //Files in a newly created folder may be added before the folder is watched
      });
    }
    watchDir(rootPath, false);
  }

  //Set up watchers
  //  Directories are watched recursively.
  //  Files are watched through their parent folder, so that files that are created later
  //  (ex. app.config.local.js), or replaced by editors on save, are still detected.
  var watchedPaths = [];
  var fileWatchesByDir = {};
  _.each(options.watch, function(watchPath){
    watchPath = path.resolve(watchPath);
    var watchStat = null;
    try{ watchStat = fs.statSync(watchPath); } catch(ex) { /* Path does not exist yet */ }

    if(watchStat && watchStat.isDirectory()){
      try{
        watchDirRecursive(watchPath, onChange);
        watchedPaths.push(watchPath + path.sep);
      }
      catch(ex){
        console.log('Error watching path "' + watchPath + '": ' + ex.toString());
      }
    }
    else {
      var parentDir = path.dirname(watchPath);
      if(!fs.existsSync(parentDir)){
        console.log('Skipping watch path "' + watchPath + '": folder does not exist');
        return;
      }
      if(!fileWatchesByDir[parentDir]) fileWatchesByDir[parentDir] = [];
      fileWatchesByDir[parentDir].push(path.basename(watchPath));
      watchedPaths.push(watchPath + (watchStat ? '' : ' (not found)'));
    }
  });
  _.each(fileWatchesByDir, function(fnames, parentDir){
    try{
      watchers.push(fs.watch(parentDir, function(evt, fname){
        if(!fname) return;
        fname = fname.toString();
        if(!_.includes(fnames, fname)) return;
        onChange(path.join(parentDir, fname));
      }));
    }
    catch(ex){
      console.log('Error watching path "' + parentDir + '": ' + ex.toString());
    }
  });

  console.log('\r\nWatching for changes on\r\n  ' + watchedPaths.join('\r\n  '));
  if(excludePaths.length) console.log('Excluding\r\n  ' + excludePaths.join('\r\n  '));
  console.log('Extensions: ' + extensions.join(','));
  console.log('');

  //Shut down the app when the CLI exits
  function shutdown(){
    if(shuttingDown) return;
    shuttingDown = true;
    _.each(watchers, function(watcher){ watcher.close(); });
    clearTimeout(restartTimer);
    if(!stopApp()) process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  startApp();
  onSuccess();
};
