#!/usr/bin/env node

/*
Copyright 2017 apHarmony

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

var wclib = require('./lib/WebConnect.js');
var xlib = wclib.xlib;
var path = require('path');
var fs = require('fs');
var os = require('os');

var path_defaultConfig = path.join(os.homedir(),'jsharmony/cli.default.json');
if(fs.existsSync(path_defaultConfig)){
  try{
    global.default_jshconfig = JSON.parse(fs.readFileSync(path_defaultConfig,'utf8'));
  }
  catch(ex){
    throw new Error('Error reading default configuration from: '+path_defaultConfig);
  }
  console.log('\r\n==== Loading default configuration ====\r\n'+path_defaultConfig+'\r\n');
}

var jshcli_CreateFactory = require('./cli.create-factory.js');
var jshcli_CreateProject = require('./cli.create-project.js');
var jshcli_CreateEmpty = require('./cli.create-empty.js');
var jshcli_CreateTutorials = require('./cli.create-tutorials.js');

var jshcli_CreateDatabase = require('./cli.create-database.js');
var jshcli_InitDatabase = require('./cli.init-database.js');

var jshcli_GenerateSalt = require('./cli.generate-salt.js');
var jshcli_GenerateCert = require('./cli.generate-cert.js');
var jshcli_GenerateModels = require('./cli.generate-models.js');
var jshcli_GenerateSQLObjects = require('./cli.generate-sqlobjects.js');

var jshcli_TestInstall = require('./cli.test-install.js');
var jshcli_TestRecorder = require('./cli.test-recorder.js');
var jshcli_TestMasterScreenshots = require('./cli.test-master-screenshots.js');
var jshcli_TestScreenshots = require('./cli.test-screenshots.js');

var jshcli_Watch = require('./cli.watch.js');
var jshcli_Dev = require('./cli.dev.js');

global._IS_WINDOWS = /^win/.test(process.platform);
global._NPM_CMD = global._IS_WINDOWS ? 'npm.cmd' : 'npm';
global._EOL = require('os').EOL;
global._NPM_VER = '';
global._NODE_VER = '';
global._DEFAULT_SQLITE_PATH = 'data/db/project.db';

global.debug = false;
global.help_text = "\r\n\
-------------------\r\n\
:::jsHarmony CLI:::\r\n\
-------------------\r\n\
Usage: jsharmony [command] [options]\r\n\
\r\n\
The following commands are available:\r\n\
\r\n\
create factory        - Initializes a standard application\r\n\
    --with-client-portal | --no-client-portal | --with-sample-data | --admin-pass [PASSWORD]\r\n\
create project [NAME] - Initializes a jsHarmony application from the App Library\r\n\
    --path [PATH]         (optional) Local filesystem path to project source\r\n\
    --url [URL]           (optional) URL path to project source\r\n\
create empty          - Initializes empty scaffolding\r\n\
create tutorials      - Initializes the quickstart tutorials application\r\n\
\r\n\
create database       - Creates a new jsHarmony Factory database\r\n\
init database         - Adds jsHarmony Factory tables to an existing database\r\n\
    --with-client-portal | --no-client-portal | --with-sample-data | --admin-pass [PASSWORD]\r\n\
\r\n\
For verbose diagnostic messages, append the -v flag\r\n\
\r\n\
generate salt         - Generate a random salt\r\n\
    --no-symbols          Generate without symbols\r\n\
    --length [LENGTH]     Generate salt with a certain length\r\n\
generate cert         - Generate a self-signed certificate\r\n\
    --domain [DOMAIN]     Certificate domain (optional)\r\n\
generate models       - Auto-generate models based on the database schema\r\n\
    -t [DATABASE TABLE]   Database table name, or * for all tables (required)\r\n\
    -f [FILENAME]         Output filename (optional)\r\n\
    -d [PATH]             Output path (optional)\r\n\
    -db [DATABASE]        Target database (optional)\r\n\
generate sqlobjects   - Auto-generate sqlobjects based on the database schema\r\n\
    -t [DATABASE TABLE]   Database table name, or * for all tables (required)\r\n\
    -f [FILENAME]         Output filename (optional)\r\n\
    -d [PATH]             Output path (optional)\r\n\
    -db [DATABASE]        Target database (optional)\r\n\
    --with-data           Include data in generated models (optional)\r\n\
    --where [WHERE]       WHERE clause for export data (optional)\r\n\
\r\n\
test install          - Install jsharmony-test in the current project\r\n\
test recorder         - Open a browser to record a new test\r\n\
    --full-element-paths  (optional) Generate full element paths instead of shortest path\r\n\
test master screenshots- Recreate the master set of screenshots for tests\r\n\
    [PATH]                (optional) directory of test files (else, current directory)\r\n\
    --config [PATH]       (optional) Local filesystem path to an alternate test config file\r\n\
    --show-browser        Show the browser window used for screenshot capture\r\n\
    --silent              Do not open image review afterwards\r\n\
test screenshots      - Recreate comparison images and run comparison report\r\n\
    [PATH]                (optional) directory of test files (else, current directory)\r\n\
    --config [PATH]       (optional) Local filesystem path to an alternate test config file\r\n\
    --show-browser        Show the browser window used for screenshot capture\r\n\
    --silent              Do not open comparison report afterwards\r\n\
\r\n\
watch [path1] [path2]  - Watch paths for changes\r\n\
    --exec [CMD]             (optional) Shell command to execute on change\r\n\
    --exec-for [REGEX] [CMD] (optional) Shell command to execute on change for path regex\r\n\
    --notify-port [PORT]     (optional) HTTP Endpoint that notifies clients of changes\r\n\
\r\n\
dev [SCRIPT]           - Run the jsHarmony app, and auto-restart when files change\r\n\
    [SCRIPT]                 (optional) App script to run (default: ./app.js)\r\n\
    --watch [PATHS]          (optional) Comma-separated paths to watch, replaces defaults\r\n\
                               (default: ./models,./app.js,./app.config.js,./app.config.local.js)\r\n\
                               or the project paths in jsharmony.project.json\r\n\
    --exclude [PATHS]        (optional) Comma-separated paths to exclude, replaces defaults\r\n\
                               (default: data,public,test,clientjs)\r\n\
    --ext [EXTENSIONS]       (optional) Comma-separated file extensions to watch, or * for all\r\n\
                               (default: node,js,json,css,sql,styl)\r\n\
    Short aliases: -w (--watch), -i (--exclude), -e (--ext).  Options can be repeated.\r\n\
";
global.commands = {
  'create factory': jshcli_CreateFactory.Run,
  'create tutorials': jshcli_CreateTutorials.Run,
  'create empty': jshcli_CreateEmpty.Run,
  'create database': jshcli_CreateDatabase.Run,
  'create project': jshcli_CreateProject.Run,
  'init database': jshcli_InitDatabase.Run,
  'generate salt': jshcli_GenerateSalt.Run,
  'generate cert': jshcli_GenerateCert.Run,
  'generate models': jshcli_GenerateModels.Run,
  'generate sqlobjects': jshcli_GenerateSQLObjects.Run,
  'test install': jshcli_TestInstall.Run,
  'test recorder': jshcli_TestRecorder.Run,
  'test master screenshots': jshcli_TestMasterScreenshots.Run,
  'test screenshots': jshcli_TestScreenshots.Run,
  'watch': jshcli_Watch.Run,
  'dev': jshcli_Dev.Run,
};
global.start_time = new Date();

process.on('exit', function () {
  if(global.debug){
    var end_time = new Date();
    var runtime_ms = end_time - global.start_time;
    Log('Run time: '+(runtime_ms/1000)+' seconds');
  }
});

function Log(txt){
  if(global.debug) console.log(txt);
}

function sys_error(txt){ return xlib.sys_error("\r\n"+txt); }

function ValidateParameters(onComplete){
  var args = [];
  var i = 0;
  var cmd = '';
  var params = { };

  process.argv.forEach(function (val, index, array) {
    i++;
    if(i >= 3) args.push(val);
  });
  if(args.length === 0){ return console.log(global.help_text); }
  cmd = args.shift();
  if(cmd=='create') cmd += ' ' + args.shift();
  if(cmd=='init') cmd += ' ' + args.shift();
  if(cmd=='generate') cmd += ' ' + args.shift();
  if(cmd=='test') cmd += ' ' + (args.shift()||'');
  if(cmd=='test master') cmd += ' ' + args.shift();
  if(!(cmd in global.commands)){ return sys_error('INVALID COMMAND: '+cmd+"\r\n\r\nPlease run jsharmony without any arguments for arguments listing"); }
  while(args.length > 0){
    var arg = args.shift();
    if(arg=='-v'){ global.debug = true; continue; }
    else if(cmd=='generate salt'){
      if(arg == '--no-symbols'){ params.NO_SYMBOLS = true; continue; }
      if(arg == '--length'){ if(args.length === 0){ return sys_error('Missing LENGTH: --length [LENGTH]'); } params.LENGTH = args.shift(); continue; }
    }
    else if(cmd=='generate cert'){
      if(arg == '--domain'){ if(args.length === 0){ return sys_error('Missing DOMAIN: --domain [DOMAIN]'); } params.DOMAIN = args.shift(); continue; }
    }
    else if(cmd=='generate models'){
      if(arg == '-t'){ if(args.length === 0){ return sys_error('Missing DATABASE TABLE: -t [DATABASE TABLE]'); } params.DATABASE_TABLE = args.shift(); continue; }
      else if(arg == '-f'){ if(args.length === 0){ return sys_error('Missing FILENAME: -f [FILENAME]'); } params.OUTPUT_FILE = args.shift(); continue; }
      else if(arg == '-d'){ if(args.length === 0){ return sys_error('Missing FILENAME: -d [PATH]'); } params.OUTPUT_PATH = args.shift(); continue; }
      else if(arg == '-db'){ if(args.length === 0){ return sys_error('Missing DATABASE: -db [PATH]'); } params.DATABASE = args.shift(); continue; }
    }
    else if(cmd=='generate sqlobjects'){
      if(arg == '-t'){ if(args.length === 0){ return sys_error('Missing DATABASE TABLE: -t [DATABASE TABLE]'); } params.DATABASE_TABLE = args.shift(); continue; }
      else if(arg == '-f'){ if(args.length === 0){ return sys_error('Missing FILENAME: -f [FILENAME]'); } params.OUTPUT_FILE = args.shift(); continue; }
      else if(arg == '-d'){ if(args.length === 0){ return sys_error('Missing FILENAME: -d [PATH]'); } params.OUTPUT_PATH = args.shift(); continue; }
      else if(arg == '-db'){ if(args.length === 0){ return sys_error('Missing DATABASE: -db [PATH]'); } params.DATABASE = args.shift(); continue; }
      else if(arg == '--with-data'){ params.WITH_DATA = true; continue; }
      else if(arg == '--where'){ if(args.length === 0){ return sys_error('Missing WHERE clause: -where [WHERE]'); } params.WHERE = args.shift(); continue; }
    }
    else if(cmd=='create factory'){
      if(arg == '--with-client-portal'){ params.CLIENT_PORTAL = true; continue; }
      else if(arg == '--no-client-portal'){ params.CLIENT_PORTAL = false; continue; }
      else if(arg == '--with-sample-data'){ params.SAMPLE_DATA = true; continue; }
      else if(arg == '--admin-pass'){ if(args.length === 0){ return sys_error('Missing PASSWORD: --admin-pass [PASSWORD]'); } params.ADMIN_PASS = args.shift(); continue; }
    }
    else if(cmd=='create project'){
      if(arg == '--path'){ if(args.length === 0){ return sys_error('Missing PATH: --path [PATH]'); } params.PATH = args.shift(); continue; }
      else if(arg == '--url'){ if(args.length === 0){ return sys_error('Missing URL: --url [URL]'); } params.URL = args.shift(); continue; }
      else if(!params.NAME){ params.NAME = arg; continue; }
    }
    else if(cmd=='create database'){
      if(arg == '--with-client-portal'){ params.CLIENT_PORTAL = true; continue; }
      else if(arg == '--no-client-portal'){ params.CLIENT_PORTAL = false; continue; }
      else if(arg == '--with-sample-data'){ params.SAMPLE_DATA = true; continue; }
      else if(arg == '--admin-pass'){ if(args.length === 0){ return sys_error('Missing PASSWORD: --admin-pass [PASSWORD]'); } params.ADMIN_PASS = args.shift(); continue; }
    }
    else if(cmd=='init database'){
      if(arg == '--with-client-portal'){ params.CLIENT_PORTAL = true; continue; }
      else if(arg == '--no-client-portal'){ params.CLIENT_PORTAL = false; continue; }
      else if(arg == '--with-sample-data'){ params.SAMPLE_DATA = true; continue; }
      else if(arg == '--admin-pass'){ if(args.length === 0){ return sys_error('Missing PASSWORD: --admin-pass [PASSWORD]'); } params.ADMIN_PASS = args.shift(); continue; }
    }
    else if(cmd=='test recorder'){
      if(arg == '--full-element-paths'){ params.FULL_ELEMENT_PATHS = true; continue; }
    }
    else if(cmd=='test master screenshots'){
      if(arg == '--config'){ if(args.length === 0){ return sys_error('Missing PATH: --config [PATH]'); } params.CONFIG = args.shift(); continue; }
      else if(arg == '--show-browser'){ params.SHOW_BROWSER = true; continue; }
      else if(arg == '--silent'){ params.SILENT = true; continue; }
      else if(!params.TEST_FOLDER_PATH){ params.TEST_FOLDER_PATH = arg; continue; }
    }
    else if(cmd=='test screenshots'){
      if(arg == '--config'){ if(args.length === 0){ return sys_error('Missing PATH: --config [PATH]'); } params.CONFIG = args.shift(); continue; }
      else if(arg == '--show-browser'){ params.SHOW_BROWSER = true; continue; }
      else if(arg == '--silent'){ params.SILENT = true; continue; }
      else if(!params.TEST_FOLDER_PATH){ params.TEST_FOLDER_PATH = arg; continue; }
    }
    else if(cmd=='watch'){
      if(!params.EXEC) params.EXEC = [];
      if(arg == '--notify-port'){ if(args.length === 0){ return sys_error('Missing PORT: --notify-port [PORT]'); } params.NOTIFY_PORT = args.shift(); continue; }
      else if(arg == '--exec'){ if(args.length === 0){ return sys_error('Missing CMD: --exec [CMD]'); } params.EXEC.push({ cmd: args.shift() }); continue; }
      else if(arg == '--exec-for'){ if(args.length < 2){ return sys_error('Missing PORT: --exec-for [REX] [CMD]'); } params.EXEC.push({ for: args.shift(), cmd: args.shift() }); continue; }
      else { if(!params.PATHS) params.PATHS = [];  params.PATHS.push(arg); continue; }
    }
    else if(cmd=='dev'){
      var devListParams = { '--watch': 'WATCH', '-w': 'WATCH', '--exclude': 'EXCLUDE', '-i': 'EXCLUDE', '--ext': 'EXT', '-e': 'EXT' };
      if(arg in devListParams){
        var devParam = devListParams[arg];
        if(args.length === 0){ return sys_error('Missing value: '+arg+' ['+devParam+']'); }
        if(!params[devParam]) params[devParam] = [];
        params[devParam] = params[devParam].concat(args.shift().split(',').map(function(val){ return val.trim(); }).filter(function(val){ return !!val; }));
        continue;
      }
      else if(!params.SCRIPT && (arg[0] != '-')){ params.SCRIPT = arg; continue; }
    }

    return sys_error('Invalid argument: '+arg);
  }
  
  //Valid output file
  if(params.OUTPUT_FILE){
    var is_valid_file = false;
    try{
      if(!fs.statSync(params.OUTPUT_FILE).isFile()){ return sys_error('OUTPUT_FILE is not a valid file'); }
      else is_valid_file = true;
    }
    catch(ex){ /* FILE NOT FOUND */ }
    if(!is_valid_file){
      //Check if folder is valid
      try{
        var dirname = path.dirname(params.OUTPUT_FILE);
        if(!fs.statSync(dirname).isDirectory()){ return sys_error('OUTPUT_FILE is not in a valid folder'); }
        else is_valid_file = true;
      }
      catch(ex){ return sys_error('OUTPUT_FILE is not in a valid folder'); }
    }
  }
  if(params.OUTPUT_PATH){
    params.OUTPUT_PATH = params.OUTPUT_PATH.replace(/[/\\]$/, "");
    //Check if folder is valid
    try{
      if(!fs.statSync(params.OUTPUT_PATH).isDirectory()){ return sys_error('OUTPUT_PATH is not a valid directory'); }
    }
    catch(ex){ return sys_error(ex.toString()); }
  }

  if(params.OUTPUT_FILE && params.OUTPUT_PATH){ return sys_error('Cannot use both OUTPUT_FILE and OUTPUT_PATH flags'); }

  if(cmd=='generate models'){
    if(!params.DATABASE_TABLE){ return sys_error('Generate models command requires a database table (-t) parameter.\r\nUse * for all tables'); }
  }

  if(cmd=='generate sqlobjects'){
    if(!params.DATABASE_TABLE){ return sys_error('Generate sqlobjects command requires a database table (-t) parameter.\r\nUse * for all tables'); }
  }

  if(onComplete) onComplete(cmd, params);
  return true;
}

//Main Workflow
ValidateParameters(function(cmd, params){
  global.commands[cmd](params, { source: 'cli' });
});
