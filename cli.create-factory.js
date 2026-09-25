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
var jshcli_CreateDatabase = require('./cli.create-database.js');
var jshcli_Shared = require('./lib/cli.shared.js');

exports = module.exports = {};

exports.Run = function(params, options, onSuccess){
  console.log('Running CreateFactory operation...');
  console.log('\r\n*** jsHarmony Factory requires a PostgreSQL, SQL Server, or SQLite database');

  var jshconfig = {
    path: process.cwd(),
    dbserver: '___DB_SERVER___',
    dbname: '___DB_NAME___',
    dbuser: '___DB_USER___',
    dbpass: '___DB_PASS___'
  };
  jshconfig.projectname = path.basename(jshconfig.path) || 'application';

  if(global.default_jshconfig) _.extend(jshconfig, global.default_jshconfig);

  Promise.resolve()
  
    //Confirm that jsHarmony factory will be set up in the current folder
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
        console.log('A new jsHarmony Factory instance will be set up in the current folder');
      }
      else{
        console.log('\r\n');
        console.log('=====================================================================');
        console.log('This command will set up the jsHarmony Factory in the current folder:');
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

    //Ask for the database type
    .then(xlib.getStringAsync(function(){
      if(jshconfig.dbtype) return false;
      console.log('\r\nPlease select a database type:');
      console.log('1) PostgreSQL');
      console.log('2) SQL Server');
      console.log('3) SQLite (Built-in File Database)');
    },function(rslt,retry){
      if(rslt=="1"){  jshconfig.dbtype = 'pgsql'; return true; }
      else if(rslt=="2"){ jshconfig.dbtype = 'mssql'; return true; }
      else if(rslt=="3"){ jshconfig.dbtype = 'sqlite'; return true; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))

    //Ask about client portal
    .then(xlib.getStringAsync(function(){
      if(typeof params.CLIENT_PORTAL != 'undefined') return false;
      console.log('\r\n-------------------------------------');
      console.log('\r\nThe Client Portal component includes:');
      console.log('\r\n> Scaffolding for Customers, Customer Users, and a Customer Dashboard');
      console.log('> Client Portal site, accessible via the "/client" URL');
      console.log('\r\nThe Client Portal can also be used as a template for projects that have one system for administrators and a separate system for users');
      console.log('\r\nInclude the Client Portal in this project?');
      console.log('1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){ params.CLIENT_PORTAL = true; return true; }
      else if(rslt=="2"){ params.CLIENT_PORTAL = false; return true; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))

    //Create app.js
    .then(function(){ return new Promise(function(resolve, reject){
      var rslt = "#!/usr/bin/env node\r\n\r\n";
      rslt += "var jsHarmonyFactory = require('jsharmony-factory');\r\n";
      rslt += "var jsh = new jsHarmonyFactory.Application("+(params.CLIENT_PORTAL?'{ clientPortal: true }':'')+");\r\n";
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
      var db_dependency = '';
      if(jshconfig.dbtype=='pgsql') db_dependency = '"jsharmony-db-pgsql": "^1.1.0",';
      else if(jshconfig.dbtype=='mssql') db_dependency = '"jsharmony-db-mssql": "^2.1.0",';
      else if(jshconfig.dbtype=='sqlite') db_dependency = '"jsharmony-db-sqlite": "^1.1.0",';
      rslt += '  "version": "0.0.1",\r\n\
  "private": true,\r\n\
  "scripts": {\r\n\
    "start": "node app.js",\r\n\
    "install-windows-service": "winser -i",\r\n\
    "uninstall-windows-service": "winser -r"\r\n\
  },\r\n\
  "dependencies": {\r\n\
    "jsharmony": "^1.1.0",\r\n\
    '+db_dependency+'\r\n' + (params.CLIENT_PORTAL?'\
    "jsharmony-report": "^1.0.0",\r\n':'') + '\
    "jsharmony-factory": "^1.1.0",\r\n\
    "jsharmony-validate": "^1.1.0",\r\n\
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
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'cert'));
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'models'));
      if(jshconfig.dbtype=='sqlite'){
        if(jshconfig.dbname && (jshconfig.dbname.substr(0,1) != ':')){
          var dbparentdir = path.dirname(jshconfig.dbname);
          if(dbparentdir && (dbparentdir != '.')) xlib.createFolderRecursiveSync(dbparentdir);
        }
      }
      resolve();
    }); })

    //Check Node.js version
    .then(function(){ return new Promise(function(resolve, reject){
      global._NODE_VER = process.versions.node;
      if(global._NODE_VER){
        global._NODE_VER = global._NODE_VER.split('.');
        if(parseInt(global._NODE_VER[0])>=8) return resolve();
      }
      console.log('ERROR: Please make sure Node.js 8 or higher is installed');
    }); })

    //Check if NPM is installed
    .then(function(){ return new Promise(function(resolve, reject){
      xlib.spawn(global._NPM_CMD,['-v'],function(code){},function(data){
        global._NPM_VER = data;
        if(global._NPM_VER){
          global._NPM_VER = global._NPM_VER.split('.');
          if(parseInt(global._NPM_VER[0])>=6) return resolve();
          console.log('ERROR: Please upgrade your NPM version to 6 or higher');
        }
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM are installed.'); }, {shell: true});
    }); })

    //Run npm install
    .then(function(){ return new Promise(function(resolve, reject){
      console.log('\r\nInstalling local dependencies');
      xlib.spawn(global._NPM_CMD,['install'],function(code){ resolve(); },function(data){
        console.log(data);
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM are installed.'); }, {shell: true});
    }); })

    //Create app.config.js
    .then(function(){ return new Promise(function(resolve, reject){
      var rslt = "exports = module.exports = function(jsh, config, dbconfig){\r\n";
      rslt += (params.CLIENT_PORTAL ? "  jsh.Extensions.report = require('jsharmony-report');\r\n" : "\r\n");
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
            jsharmony_factory_client_portal: !!params.CLIENT_PORTAL
          }
        }
      };

      //Add dbconfig
      if(jshconfig.dbtype){
        appConfig.body += "  //Database Configuration\r\n";
        if(jshconfig.dbtype=='pgsql'){
          appConfig.header = "var pgsqlDBDriver = require('jsharmony-db-pgsql');\r\n";
          appConfig.body += "  dbconfig['default'] = { _driver: new pgsqlDBDriver(), host: "+JSON.stringify(jshconfig.dbserver)+", database: "+JSON.stringify(jshconfig.dbname)+", user: "+JSON.stringify(jshconfig.dbuser)+", password: "+JSON.stringify(jshconfig.dbpass)+" };\r\n";
        }
        else if(jshconfig.dbtype=='mssql'){
          appConfig.header = "var mssqlDBDriver = require('jsharmony-db-mssql');\r\n";
          appConfig.body += "  dbconfig['default'] = { _driver: new mssqlDBDriver(), server: "+JSON.stringify(jshconfig.dbserver)+", database: "+JSON.stringify(jshconfig.dbname)+", user: "+JSON.stringify(jshconfig.dbuser)+", password: "+JSON.stringify(jshconfig.dbpass)+" };\r\n";
        }
        else if(jshconfig.dbtype=='sqlite'){
          appConfig.header = "var sqliteDBDriver = require('jsharmony-db-sqlite');\r\n";
          appConfig.body += "  dbconfig['default'] = { _driver: new sqliteDBDriver(), database: "+JSON.stringify(jshconfig.dbname)+" };\r\n";
        }
      }

      //Save app.config.local.js to disk
      var onComplete = function(err){
        if(err) return reject(err);

        var fdata = '';
        if(appConfig.header) fdata += appConfig.header + "\r\n";
        fdata += "exports = module.exports = function(jsh, config, dbconfig){\r\n";
        fdata += "\r\n";
        fdata += appConfig.body + "\r\n";
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

    //Copy Client Portal files, if applicable
    .then(function(){ return new Promise(function(resolve, reject){
      if(!params.CLIENT_PORTAL) return resolve();
      jshcli_Shared.copyRecursive(path.join(jshconfig.path,'node_modules/jsharmony-factory/sample/client_portal'), path.join(jshconfig.path,'models'), {}, function(err){
        if(err){ console.log('Error copying client portal models'); return reject(); }
        return resolve();
      });
    }); })

    //Ask to create a new database
    .then(xlib.getStringAsync(function(){
      global._CREATE_DATABASE = false;
      console.log('\r\nA database is required to run the jsHarmony Factory');
      console.log('\r\nCreate a new database for this jsHarmony Factory project?');
      console.log('1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){ global._CREATE_DATABASE = true; return true; }
      else if(rslt=="2"){ return true; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))

    //Create jsHarmony Factory Database
    .then(function(){ return new Promise(function(resolve, reject){
      if(!global._CREATE_DATABASE){
        console.log('\r\nPlease configure your database settings in '+path.join(jshconfig.path,'app.config.local.js'));
        console.log('Then run "jsharmony init database" to set up the jsHarmony Factory tables in the existing database');
        console.log('\r\nIf you decide to create a new database for the project, instead run "jsharmony create database" from the project root to automatically create the database.');
        return resolve();
      }
      else jshcli_CreateDatabase.Run(params,{},resolve);
    }); })

    .then(function(){ return new Promise(function(resolve, reject){
      resolve();
    }); })

    //Done
    .then(function(){
    })

    .catch(function(err){
      if(err) console.log(err);
      process.exit(1);
    });

  return;
};