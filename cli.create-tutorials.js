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
var _ = require('lodash');
var jshcli_Shared = require('./lib/cli.shared.js');

exports = module.exports = {};

exports.Run = function(params, options, onSuccess){
  console.log('Running CreateTutorials operation...');

  var jshconfig = {
    path: process.cwd()
  };
  jshconfig.projectname = path.basename(jshconfig.path) || 'application';
  jshconfig.dbtype = 'sqlite';

  if(global.default_jshconfig) _.extend(jshconfig, global.default_jshconfig);

  Promise.resolve()
  
    //Confirm that jsHarmony Tutorials will be set up in the current folder
    .then(xlib.getStringAsync(function(){
      var hasExistingFiles = _.difference(fs.readdirSync(jshconfig.path), ['.git']).length;
      if(hasExistingFiles){
        console.log('\r\n');
        console.log('=====================================================');
        console.log(' __          __     _____  _   _ _____ _   _  _____ ');
        console.log(' \\ \\        / /\\   |  __ \\| \\ | |_   _| \\ | |/ ____|');
        console.log('  \\ \\  /\\  / /  \\  | |__) |  \\| | | | |  \\| | |  __ ');
        console.log('   \\ \\/  \\/ / /\\ \\ |  _  /| . ` | | | | . ` | | |_ |');
        console.log('    \\  /\\  / ____ \\| | \\ \\| |\\  |_| |_| |\\  | |__| |');
        console.log('     \\/  \\/_/    \\_\\_|  \\_\\_| \\_|_____|_| \\_|\\_____|');
        console.log('');
        console.log('=====================================================');
        console.log('=====================================================================');
        console.log('One or more files were found in this folder!');
        console.log('This command may delete and overwrite an existing project');
        console.log('Existing configuration and models may be overwritten');
        console.log('=====================================================================');
        console.log('A new jsHarmony Tutorials project will be set up in the current folder');
      }
      else{
        console.log('\r\n');
        console.log('=====================================================================');
        console.log('This command will set up the jsHarmony Tutorials in the current folder:');
      }
      console.log(jshconfig.path);
      console.log('=====================================================================');
      console.log('Continue with the operation?');
      console.log('1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){ return true; }
      else if(rslt=="2"){ return false; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))
  
    //Create app.js
    .then(function(){ return new Promise(function(resolve, reject){
      var rslt = "#!/usr/bin/env node\r\n\r\n";
      rslt += "var jsHarmonyTutorials = require('jsharmony-tutorials');\r\n";
      rslt += "var jsh = new jsHarmonyTutorials.Application();\r\n";
      rslt += "jsh.Run();\r\n";
      if(!global._IS_WINDOWS) rslt = jshcli_Shared.dos2unix(rslt);
      fs.writeFileSync(path.join(jshconfig.path,'app.js'), rslt);
      if(!global._IS_WINDOWS) fs.chmodSync(path.join(jshconfig.path,'app.js'), '755');
      resolve();
    }); })

    //Create package.json
    .then(function(){ return new Promise(function(resolve, reject){
      var rslt = "{\r\n";
      rslt += '  "name": '+JSON.stringify(jshconfig.projectname)+',\r\n';
      var db_dependency = '"jsharmony-db-sqlite": "^1.1.0",';
      rslt += '  "version": "0.0.1",\r\n\
  "private": true,\r\n\
  "scripts": {\r\n\
    "start": "node app.js",\r\n\
    "test-screenshots": "mocha node_modules/jsharmony-tutorials/test/screenshots.js"\r\n\
  },\r\n\
  "dependencies": {\r\n\
    "jsharmony": "^1.1.0",\r\n\
    '+db_dependency+'\r\n\
    "jsharmony-factory": "^1.1.0",\r\n\
    "jsharmony-image-sharp": "^1.0.0",\r\n\
    "jsharmony-report": "^1.0.0",\r\n\
    "jsharmony-validate": "^1.1.0",\r\n\
    "jsharmony-tutorials": "^1.0.0",\r\n\
    "winser": "^1.0.2"\r\n\
  },\r\n\
  "devDependencies": {\r\n\
    "mocha": "^8.4.0"\r\n\
  }\r\n';
      rslt += "}\r\n";
      fs.writeFileSync(path.join(jshconfig.path,'package.json'), rslt);
      resolve();
    }); })

    //Create gitignore
    .then(function(){ return new Promise(function(resolve, reject){
      var ignorePaths = ['/app.config.*.js','/node_modules','/cert','/data'];
      fs.writeFileSync(path.join(jshconfig.path,'.gitignore'), ignorePaths.join(global._EOL));
      resolve();
    }); })

    //Create folders if they do not exist
    .then(function(){ return new Promise(function(resolve, reject){
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'data'));
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'data/db'));
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'cert'));
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'models'));
      resolve();
    }); })

    //Check Node.js version
    .then(function(){ return new Promise(function(resolve, reject){
      global._NODE_VER = process.versions.node;
      if(global._NODE_VER){
        global._NODE_VER = global._NODE_VER.split('.');
        if(parseInt(global._NODE_VER[0])>=6) return resolve();
      }
      console.log('ERROR: Please make sure Node.js 6 or higher is installed');
    }); })

    //Check if NPM is installed
    .then(function(){ return new Promise(function(resolve, reject){
      xlib.spawn(global._NPM_CMD,['-v'],function(code){},function(data){
        global._NPM_VER = data;
        if(global._NPM_VER){
          global._NPM_VER = global._NPM_VER.split('.');
          if(parseInt(global._NPM_VER[0])>=3) return resolve();
          console.log('ERROR: Please upgrade your NPM version to 3 or higher');
        }
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM is installed.'); }, {shell: true});
    }); })

    //Run npm install
    .then(function(){ return new Promise(function(resolve, reject){
      console.log('\r\nInstalling local dependencies');
      xlib.spawn(global._NPM_CMD,['install'],function(code){ resolve(); },function(data){
        console.log(data);
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM is installed.'); }, {shell: true});
    }); })

    //Create app.config.js
    .then(function(){ return new Promise(function(resolve, reject){
      var rslt = "exports = module.exports = function(jsh, config, dbconfig){\r\n";
      rslt += "\r\n";
      rslt += "}\r\n";
    
      fs.writeFileSync(path.join(jshconfig.path,'app.config.js'), rslt);
      resolve();
    }); })

    //Create app.config.local.js
    .then(function(){ return new Promise(function(resolve, reject){
      var appConfig = {
        header: '',
        body: '',
        params: {},
      };

      var installerParams = {
        xlib: xlib,
        manifest: {
          installer: {
            jsharmony_factory_client_portal: true
          }
        }
      };

      //Save app.config.local.js to disk
      var onComplete = function(err){
        if(err) return reject(err);

        var fdata = '';
        if(appConfig.header) fdata += appConfig.header + "\r\n";
        fdata += "exports = module.exports = function(jsh, config, dbconfig){\r\n";
        fdata += "\r\n";
        fdata += "  jsh.Extensions.image = require('jsharmony-image-sharp');\r\n";
        fdata += "  jsh.Extensions.report = require('jsharmony-report');\r\n";
        fdata += "\r\n";
        fdata += appConfig.body + "\r\n";
        fdata += "  var configTutorials = config.modules['jsHarmonyTutorials'];\r\n";
        fdata += "  if(configTutorials){\r\n";
        fdata += "    //configTutorials.enable_dev = true;\r\n";
        fdata += "  }\r\n";
        fdata += "\r\n";
        fdata += "  config.onServerReady.push(function(cb, servers){\r\n";
        fdata += "    var port = jsh.Config.server.http_port;\r\n";
        fdata += "    if(jsh.Servers['default'] && jsh.Servers['default'].servers && jsh.Servers['default'].servers.length) port = jsh.Servers['default'].servers[0].address().port;\r\n";
        fdata += "    var exec = require('child_process').exec;\r\n";
        fdata += "    exec('start http://localhost:'+port+'/', { });\r\n";
        fdata += "    return cb();\r\n";
        fdata += "  });\r\n";
        fdata += "}\r\n";
        fs.writeFile(path.join(jshconfig.path, 'app.config.local.js'), fdata, 'utf8', function(err){
          if(err) return reject(err);
          return resolve();
        });
      };

      jshcli_Shared.getModulePath('jsharmony-factory/init/install.app.config.local.js', function(err, mpath){
        if(err) return onComplete();
        require(mpath)(appConfig, installerParams, onComplete);
      });
    }); })

    //Done
    .then(function(){ return new Promise(function(resolve, reject){
      console.log('');
      console.log('');
      console.log('jsHarmony Tutorials have been initialized!');
      console.log('');
      console.log('Start the tutorials by running:');
      console.log('  jsharmony dev    (auto-restarts when files change)');
      console.log('    or');
      console.log('  node '+(global._IS_WINDOWS?'app.js':'./app.js'));
      resolve();
    }); })

  /*
    //Run npm start
    .then(function(){ return new Promise(function(resolve, reject){
      console.log('\r\nStarting Tutorials');
      xlib.spawn(global._NPM_CMD,['start'],function(code){ resolve(); },function(data){
        console.log(data);
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM is installed.'); }, {shell: true});
    }); })
    */

    .then(function(){
      //Operation complete
    });

  return;
};