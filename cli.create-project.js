/*
Copyright 2020 apHarmony

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
var wc = new wclib.WebConnect();
var xlib = wclib.xlib;
var path = require('path');
var os = require('os');
var fs = require('fs');
var _ = require('lodash');
var URL = require('url');
var async = require('async');
var jshcli_CreateDatabase = require('./cli.create-database.js');
var jshcli_Shared = require('./lib/cli.shared.js');

exports = module.exports = {};

exports.Run = function(params, options, onSuccess){
  console.log('Running CreateProject operation...');

  var jshconfig = _.extend({
    path: process.cwd(),
    dbserver: '___DB_SERVER___',
    dbname: '___DB_NAME___',
    dbuser: '___DB_USER___',
    dbpass: '___DB_PASS___',
    dbtype: undefined,
    ignore_overwrite_warning: false,
    agreement_accepted: false,
    no_npm_install: false,
    auto_create_database: false,
    projectname: null,
  }, global.default_jshconfig);

  jshconfig.projectname = jshconfig.projectname || path.basename(jshconfig.path) || 'application';

  if(!params.NAME && !params.URL && !params.PATH){
    console.log('ERROR: The "create project" operation requires a project NAME parameter :: the name of the project in the jsHarmony App Library');
    process.exit(1);
  }

  var tmpdir = '';
  var projectFiles = [];
  var ignoreItems = ['.git','/package.json','/package-lock.json','/yarn.lock'];
  var ignoreDirItems = ['.git'];
  var manifest = {};
  var jsHarmonyFactoryScriptResult = null;
  var sourceDir = undefined;

  var dbtypes_keys = [];

  process.on('exit', function(){
    if(tmpdir) jshcli_Shared.rmdirRecursiveSync(tmpdir);
  });

  Promise.resolve()
  
    //Confirm that jsHarmony factory will be set up in the current folder
    .then(xlib.getStringAsync(function(){
      if(jshconfig.ignore_overwrite_warning) return false;
      var hasExistingFiles = _.difference(fs.readdirSync(jshconfig.path), ignoreItems).length;
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
        console.log('A new jsHarmony project will be set up in the current folder');
      }
      else{
        console.log('\r\n');
        console.log('=====================================================================');
        console.log('This command will set up a jsHarmony project in the current folder:');
      }
      console.log(jshconfig.path);
      console.log('=====================================================================');
      console.log('The project will be based on the following source:');
      console.log(params.PATH||params.URL||params.NAME);
      console.log('=====================================================================');
      console.log('Continue with the operation?');
      console.log('1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){ return true; }
      else if(rslt=="2"){ return false; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))

    //Accept Agreement
    .then(xlib.getStringAsync(function(){
      if(jshconfig.agreement_accepted) return false;
      if(jshconfig.dbtype) return false;
      console.log('\r\n=====================================================================');
      console.log('Do you accept the following usage agreement?');
      console.log('\r\nJSHARMONY DOES NOT CURATE, MODERATE, OR ENDORSE SOFTWARE PROJECTS DOWNLOADED VIA THE JSHARMONY CLI.  ANY SOFTWARE DOWNLOADED USING THE JSHARMONY CLI IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE SOFTWARE AUTHORS, COPYRIGHT HOLDERS, SOFTWARE WEB HOSTS, JSHARMONY, OR ANY ORGANIZATION AFFILIATED WITH JSHARMONY BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.');
      console.log('\r\n1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){  return true; }
      else if(rslt=="2"){ console.log('jsHarmony Projects can only be downloaded by users who accept the usage agreement.'); return; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))

    //Download Project
    .then(function(){ return new Promise(function(resolve, reject){
      fs.mkdtemp(path.join(os.tmpdir(), 'jsh-tmp-download-'), function(err, fpath){
        if(err) return reject(err);
        tmpdir = fpath;
      
        var targetPath = path.join(tmpdir, 'project.zip');

        var download_PATH = function(download_cb){
          if(fs.existsSync(params.PATH)){
            var fstat = fs.lstatSync(params.PATH);
            if(fstat.isDirectory()){
              sourceDir = params.PATH;
              return download_cb();
            }
            else {
              jshcli_Shared.copyFile(params.PATH, targetPath, function(err){
                if(err){
                  console.log('------------------------------------------');
                  console.log('Could not extract project source zip file.');
                  console.log('------------------------------------------');
                  return download_cb(err);
                }
                return download_cb();
              });
            }
          }
          else throw new Error('Invalid project source zip file: ' + params.PATH);
        };

        var download_URL = function(download_cb){
          var projectURL = {};
          try{
            projectURL = URL.parse(params.URL);
          }catch(ex){
            throw new Error('Invalid URL: ' + params.URL);
          }

          if(_.includes(['http:','https:'], (projectURL.protocol||'').toLowerCase())){
            wc.req(params.URL, 'GET', {}, {}, targetPath, function(err, res, rslt){
              if(err){
                console.log('-------------------------------------------');
                console.log('Could not download project source zip file.');
                console.log('-------------------------------------------');
                return download_cb(err);
              }
              if(rslt == '---SAVEDTOFILE---') return download_cb();
              else {
                console.log('Error downloading project');
                console.log('Server Response: ' + rslt);
                return download_cb('Could not download project');
              }
            });
          }
          else {
            return download_cb(new Error('Unsupported URL: '+params.URL));
          }
        };

        var download_NAME = function(download_cb){
          params.URL = 'https://library.jsharmony.com/download/'+params.NAME;
          return download_URL(download_cb);
        };

        (
          params.PATH ? download_PATH :
            params.URL ? download_URL :
              params.NAME ? download_NAME :
                function(download_cb){ return download_cb(new Error('Project NAME not specified')); }
        )(function(err){
          if(err) return reject(err);
          return resolve();
        });
      });
    }); })

    //Review Project Folder Structure
    .then(function(){ return new Promise(function(resolve, reject){
      if(sourceDir){
        jshcli_Shared.funcRecursive(sourceDir, function (filepath, relativepath, file_cb) { //filefunc
          projectFiles.push(relativepath);
          return file_cb();
        }, function (dirpath, relativepath, dir_cb) { //dirfunc
          if (_.includes(ignoreDirItems, relativepath)) return dir_cb(false);
          return dir_cb();
        }, undefined, function(err){
          if(err) return reject(err);
          return resolve();
        });
      }
      else {
        jshcli_Shared.unzip(path.join(tmpdir, 'project.zip'), null,
          {
            onEntry: function(entry){
              projectFiles.push(entry.fileName);
            }
          },
          function(err){
            if(err) return reject(err);
            return resolve();
          }
        );
      }
    }); })

    //Extract Project
    .then(function(){ return new Promise(function(resolve, reject){
      //Find all manifests
      var manifests = [];

      _.each(projectFiles, function(file){
        if(path.basename(file)=='jsharmony.project.json'){
          var manifestDepth = file.split('/').length;
          manifests.push({
            file: file,
            depth: manifestDepth,
          });
        }
      });
      manifests.sort(function(a,b){
        if(a.depth > b.depth) return 1;
        if(a.depth < b.depth) return -1;
        return 0;
      });

      if(!manifests.length) return reject(new Error('Project manifest file "jsharmony.project.json" not found in archive'));
      if(manifests.length > 1){
        if(manifests[0].depth == manifests[1].depth) return reject(new Error('Could not identify which project manifest to use.  Please move the "jsharmony.project.json" project manifest to the root folder of the archive'));
      }
    
      var manifestPath = manifests[0].file;
      var rootPath = path.normalize(path.dirname(manifestPath));
      if(rootPath == '/') { /* Do nothing */ }
      else if(!rootPath || (rootPath=='.')){ rootPath = ''; }
      else rootPath += path.sep;

      projectFiles = [];
      if(sourceDir){
        jshcli_Shared.funcRecursive(sourceDir, function (filepath, relativepath, file_cb) { //filefunc
          var fname = path.normalize(relativepath);
          if(fname.indexOf(rootPath) != 0) return file_cb();
          if (_.includes(ignoreItems, fname)) return file_cb();
          if (_.includes(ignoreItems, path.basename(fname))) return file_cb();
          fname = fname.substr(rootPath.length);
          if(!fname) return file_cb();
          if (_.includes(ignoreItems, '/' + fname.split(path.sep).join('/'))) return file_cb();
          projectFiles.push(fname);
          jshcli_Shared.copyFile(filepath, path.join(jshconfig.path, fname), file_cb);
        }, function (dirpath, relativepath, dir_cb) { //dirfunc
          if (_.includes(ignoreDirItems, relativepath)) return dir_cb(false);
          jshcli_Shared.createFolderIfNotExists(path.join(jshconfig.path, relativepath), dir_cb);
        }, undefined, function(err){
          if(err) return reject(err);
          return resolve();
        });
      }
      else {
        jshcli_Shared.unzip(path.join(tmpdir, 'project.zip'), jshconfig.path,
          {
            onEntry: function(entry){
              var fname = path.normalize(entry.fileName);
              if(fname.indexOf(rootPath) != 0) return false;
              if (_.includes(ignoreItems, fname)) return false;
              if (_.includes(ignoreItems, path.basename(fname))) return false;
              fname = fname.substr(rootPath.length);
              if(!fname) return false;
              if (_.includes(ignoreItems, '/' + fname.split(path.sep).join('/'))) return false;
              projectFiles.push(fname);
              return fname;
            }
          },
          function(err){
            if(err) return reject(err);
            return resolve();
          }
        );
      }
    }); })

    //Clear Temp Folder
    .then(function(){ return new Promise(function(resolve, reject){
      for(var i=0;i<projectFiles.length;i++){
        var fname = projectFiles[i];
        var basefname = path.basename(fname);
        if(fname==basefname){
          if(fname=='package.json') return reject('jsHarmony Project cannot have a "package.json" file in the zip archive.  This will be auto-generated by the installer based on the jsharmony.project.json manifest');
          if((/app\.config\.(.*)\.js$/.test(fname))) return reject('jsHarmony Project cannot have a localized "app.config.*.js" file in the zip archive.  Only the base app.config.js is allowed.');
        }
      }
      return resolve();
    }); })

    //Clear Temp Folder
    .then(function(){ return new Promise(function(resolve, reject){
      jshcli_Shared.rmdirRecursiveSync(tmpdir);
      return resolve();
    }); })

    //Read manifest
    .then(function(){ return new Promise(function(resolve, reject){
      jshcli_Shared.readManifest(path.join(jshconfig.path, 'jsharmony.project.json'), function(err, _manifest){
        if(err){
          console.log('Error reading jsharmony.project.json');
          return reject(err);
        }
        manifest = _manifest;
        params.CLIENT_PORTAL = !!manifest.installer.jsharmony_factory_client_portal;
        return resolve();
      });
    }); })

    //Ask for the database type
    .then(xlib.getStringAsync(function(){
      if(jshconfig.dbtype) return false;
      if((manifest.database===false) || (manifest.database && manifest.database.type === false) || (manifest.database && !manifest.database.type && !manifest.database.type.length)) return false;
      var dbtypes = {
        pgsql: 'PostgreSQL',
        mssql: 'SQL Server',
        sqlite: 'SQLite (File DB - Use this if you won\'t install a database server)',
      };
      if(manifest.database && manifest.database.type){
        _.each(_.keys(dbtypes), function(dbtype){
          if(!_.includes(manifest.database.type, dbtype)) delete dbtypes[dbtype];
        });
      }
      dbtypes_keys = _.keys(dbtypes);
      if(!dbtypes_keys.length) return false;
      if(dbtypes_keys.length==1){
        jshconfig.dbtype = dbtypes_keys[0];
        return false;
      }

      console.log('\r\nPlease select a database type:');
      for(var i=0;i<dbtypes_keys.length;i++){
        console.log((i+1)+') ' + dbtypes[dbtypes_keys[i]]);
      }
    },function(rslt,retry){
      if(rslt && (parseInt(rslt).toString()==rslt)){
        rslt = parseInt(rslt)-1;
        if(dbtypes_keys[rslt]){ jshconfig.dbtype = dbtypes_keys[rslt]; return true; }
      }
      console.log('Invalid entry.  Please enter the number of your selection');
      retry();
    }))

    //Define package.json
    .then(function(){ return new Promise(function(resolve, reject){
      if(!manifest.package) manifest.package = {};

      var defaultPackage = {
        name: jshconfig.projectname,
        main: "app.js",
        private: true,
      };
      defaultPackage.scripts = {
        "start": "node app.js",
      };
      defaultPackage.dependencies = {
        "async": "^2.6.2",
        "jsharmony": "^1.1.0",
        "jsharmony-validate": "^1.1.0",
        "lodash": "^4.17.19",
      };
      defaultPackage.devDependencies = {
        "mocha": "^8.4.0"
      };

      if(!global._IS_WINDOWS){
        defaultPackage.scripts = _.extend({
          "install-windows-service": "winser -i",
          "uninstall-windows-service": "winser -r",
        }, defaultPackage.scripts);
        defaultPackage.dependencies = _.extend({
          "winser": "^1.0.2"
        }, defaultPackage.dependencies);
      }

      //jsHarmony Factory
      if(manifest.installer.jsharmony_factory){
        defaultPackage.scripts = _.extend({
        }, defaultPackage.scripts);
        defaultPackage.dependencies = _.extend({
          "jsharmony-factory": "^1.1.0",
        }, defaultPackage.dependencies);
      }

      //Database
      if(jshconfig.dbtype){
        if(jshconfig.dbtype=='pgsql') defaultPackage.dependencies["jsharmony-db-pgsql"] = "^1.1.0";
        else if(jshconfig.dbtype=='mssql') defaultPackage.dependencies["jsharmony-db-mssql"] = "^2.0.0";
        else if(jshconfig.dbtype=='sqlite') defaultPackage.dependencies["jsharmony-db-sqlite"] = "^1.1.0";
      }

      for(var key in defaultPackage){
        if(manifest.package[key] && manifest.package[key]['__REMOVEALL__']){
          delete manifest.package[key]['__REMOVEALL__'];
          delete defaultPackage[key];
        }
        else if(manifest.package[key] == '__REMOVE__'){
          delete manifest.package[key];
          delete defaultPackage[key];
        }
      }

      manifest.package = _.extend({}, defaultPackage, manifest.package);
      _.each(['scripts','dependencies','devDependencies'], function(key){
        if(defaultPackage[key]){
          manifest.package[key] = _.extend(defaultPackage[key], manifest.package[key]);
        }
      });
    
      return resolve();
    }); })
  
    //Call pre_install
    .then(function(){ return new Promise(function(resolve, reject){
      if(!manifest.installer.scripts.pre_install) return resolve();
      if(fs.existsSync(path.join(jshconfig.path,manifest.installer.scripts.pre_install))){
        jshcli_Shared.runScript(path.join(jshconfig.path,manifest.installer.scripts.pre_install),[],{},function(errCode){
          if(!errCode) return resolve();
        });
        return;
      }
      resolve();
    }); })

    //Write package.json to disk
    .then(function(){ return new Promise(function(resolve, reject){
      fs.writeFileSync(path.join(jshconfig.path,'package.json'), JSON.stringify(manifest.package, null, 2));
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
      if(jshconfig.no_npm_install) return resolve();
      console.log('\r\nInstalling local dependencies');
      xlib.spawn(global._NPM_CMD,['install'],function(code){ resolve(); },function(data){
        console.log(data);
      },undefined,function(err){ console.log('ERROR: Could not find or start '+global._NPM_CMD+'. Check to make sure Node.js and NPM are installed.'); }, {shell: true});
    }); })

    //Run dos2unix on executable JS
    .then(function(){ return new Promise(function(resolve, reject){
      async.eachSeries(manifest.installer.executables,
        function(fname, executable_cb){
          var fpath = path.join(jshconfig.path, fname);
          var fdata = '';
          async.waterfall([
            function(executable_task_cb){
              fs.readFile(fpath, 'utf8', function(err, _data){
                if(err) return executable_task_cb(err);
                fdata = _data;
                return executable_task_cb();
              });
            },
            function(executable_task_cb){
              if(global._IS_WINDOWS) return executable_task_cb();
              fdata = jshcli_Shared.dos2unix(fdata);
              if(fdata.indexOf('#!') != 0){
                fdata = '#!/usr/bin/env node\n\n' + fdata;
              }
              fs.writeFile(fpath, fdata, function(err){
                if(err) return executable_task_cb(err);
                return executable_task_cb();
              });
            },
            function(executable_task_cb){
              if(global._IS_WINDOWS) return executable_task_cb();
              fs.chmod(fname, '755', function(err){
                if(err) return executable_task_cb(err);
                return executable_task_cb();
              });
            },
          ], executable_cb);
        },
        function(err){
          if(err) return reject(err);
          return resolve();
        }
      );
    }); })

    //Create app.config.local.js
    .then(function(){ return new Promise(function(resolve, reject){
      var localInstaller = path.join(jshconfig.path, 'init/install.app.config.local.js');

      var appConfig = {
        header: '',
        body: '',
        params: {},
      };

      var installerParams = {
        xlib: xlib,
        manifest: manifest,
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

      async.waterfall([
        function(installer_cb){
          if(fs.existsSync(localInstaller)){
            require(localInstaller)(appConfig, installerParams, onComplete);
            return;
          }
          return installer_cb();
        },

        function(installer_cb){
          if(!manifest.installer.jsharmony_factory) return installer_cb();
          var jsHarmonyFactoryInstaller ='jsharmony-factory/init/install.app.config.local.js';
          jshcli_Shared.getModulePath(jsHarmonyFactoryInstaller, function(err, mpath){
            if(err) return installer_cb();
            require(mpath)(appConfig, installerParams, onComplete);
          });
        },

        function(installer_cb){
          if(!manifest.package.dependencies.jsharmony) return installer_cb();
          var jsHarmonyInstaller ='jsharmony/init/install.app.config.local.js';
          jshcli_Shared.getModulePath(jsHarmonyInstaller, function(err, mpath){
            if(err) return installer_cb();
            require(mpath)(appConfig, installerParams, onComplete);
          });
        },

      ], function(err){
        if(err) return reject(err);
        return resolve();
      });
    }); })

    //Generate self-signed certs
    .then(function(){ return new Promise(function(resolve, reject){
      async.eachSeries(manifest.installer.generate_self_signed_certs,
        function(certInfo, cert_cb){
          if(!certInfo || !certInfo.key) return cert_cb(new Error('Cannot generate self-signed cert - missing "key" attribute: ' + JSON.stringify(certInfo)));
          if(!certInfo || !certInfo.cert) return cert_cb(new Error('Cannot generate self-signed cert - missing "cert" attribute: ' + JSON.stringify(certInfo)));
          var certData = jshcli_Shared.generateSelfSignedCert(3650, 'localhost');
          async.waterfall([
            function(cert_task_cb){
              if(path.isAbsolute(certInfo.key)) return cert_task_cb(new Error('Key path cannot be absolute'));
              if(certInfo.key.indexOf('..')>=0) return cert_task_cb(new Error('Key path cannot contain directory traversals'));
              var keyPath = path.join(jshconfig.path, certInfo.key);
              jshcli_Shared.createFolderRecursive(path.dirname(keyPath), function(err){
                if(err) return cert_task_cb(err);
                fs.writeFile(keyPath, certData.key, 'utf8', function(err){
                  if(err) return cert_task_cb(err);
                  return cert_task_cb();
                });
              });
            },
            function(cert_task_cb){
              if(path.isAbsolute(certInfo.cert)) return cert_task_cb(new Error('Cert path cannot be absolute'));
              if(certInfo.cert.indexOf('..')>=0) return cert_task_cb(new Error('Cert path cannot contain directory traversals'));
              var certPath = path.join(jshconfig.path, certInfo.cert);
              jshcli_Shared.createFolderRecursive(path.dirname(certPath), function(err){
                if(err) return cert_task_cb(err);
                fs.writeFile(certPath, certData.cert, 'utf8', function(err){
                  if(err) return cert_task_cb(err);
                  return cert_task_cb();
                });
              });
            },
          ], cert_cb);
        },
        function(err){
          if(err) return reject(err);
          return resolve();
        }
      );
    }); })

    //Create data folder if it does not exist
    .then(function(){ return new Promise(function(resolve, reject){
      xlib.createFolderIfNotExistsSync(path.join(jshconfig.path,'data'));
      if(jshconfig.dbtype=='sqlite'){
        if(jshconfig.dbname && (jshconfig.dbname.substr(0,1) != ':')){
          var dbparentdir = path.dirname(jshconfig.dbname);
          if(dbparentdir && (dbparentdir != '.')) xlib.createFolderRecursiveSync(dbparentdir);
        }
      }
      resolve();
    }); })

    //Create gitignore
    .then(function(){ return new Promise(function(resolve, reject){
      if(!manifest.installer.generate_gitignore) return resolve();
      var ignorePaths = [];
      if(_.isArray(manifest.installer.generate_gitignore)) ignorePaths = manifest.installer.generate_gitignore;
      else if(_.isString(manifest.installer.generate_gitignore)) throw new Error('jsharmony.project.json generate_gitignore must be an array of paths or boolean true');
      else ignorePaths = ['/app.config.*.js','/node_modules','/cert','/data'];

      fs.writeFileSync(path.join(jshconfig.path,'.gitignore'), ignorePaths.join(global._EOL));
      resolve();
    }); })

    //Ask to create a new database
    .then(xlib.getStringAsync(function(){
      if(!manifest.installer.jsharmony_factory || !jshconfig.dbtype) return false;
      if(jshconfig.auto_create_database || manifest.installer.auto_create_database){
        global._CREATE_DATABASE = true;
        return false;
      }
      global._CREATE_DATABASE = false;
      console.log('\r\nA database is required to run the project');
      console.log('\r\nCreate a new database for this jsHarmony project?');
      console.log('1) Yes');
      console.log('2) No');
    },function(rslt,retry){
      if(rslt=="1"){ global._CREATE_DATABASE = true; return true; }
      else if(rslt=="2"){ return true; }
      else{ console.log('Invalid entry.  Please enter the number of your selection'); retry(); }
    }))
  
    //Create jsHarmony Factory Database
    .then(function(){ return new Promise(function(resolve, reject){
      if(!manifest.installer.jsharmony_factory || !jshconfig.dbtype) return false;
      if(!global._CREATE_DATABASE){
        console.log('\r\nPlease configure your database settings in '+path.join(jshconfig.path,'app.config.local.js'));
        console.log('Then run "jsharmony init database" to set up the jsHarmony Factory tables in the existing database');
        console.log('\r\nIf you decide to create a new database for the project, instead run "jsharmony create database" from the project root to automatically create the database.');
        return resolve();
      }
      else{
        jshcli_CreateDatabase.Run(params,
          {
            showResultMessage: false,
            useDefaultSQLitePath: (jshconfig.auto_create_database || manifest.installer.auto_create_database),
            preCreate: manifest.installer.scripts.pre_db_create,
            preInit: manifest.installer.scripts.pre_db_init,
            postInit: manifest.installer.scripts.post_db_init,
          },
          function(rslt){
            jsHarmonyFactoryScriptResult = rslt;
            resolve();
          }
        );
      }
    }); })

    //Call post_install
    .then(function(){ return new Promise(function(resolve, reject){
      if(!manifest.installer.scripts.post_install) return resolve();
      if(fs.existsSync(path.join(jshconfig.path,manifest.installer.scripts.post_install))){
        jshcli_Shared.runScript(path.join(jshconfig.path,manifest.installer.scripts.post_install),[],{},function(errCode){
          if(!errCode) return resolve();
        });
        return;
      }
      resolve();
    }); })

    .then(function(){ return new Promise(function(resolve, reject){
      if(jsHarmonyFactoryScriptResult && jsHarmonyFactoryScriptResult.RESULT_MESSAGE){
        console.log('\r\n\r\n\r\n'+jsHarmonyFactoryScriptResult.RESULT_MESSAGE);
      }
      resolve();
    }); })

    //Done
    .then(function(){
    })

    .catch(function(err){
      if(err){
        console.log(err);
        process.exit(1);
      }
    });

  return;
};