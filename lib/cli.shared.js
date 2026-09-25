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

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var yauzl = require('yauzl');
var forge = require('node-forge');
var Transform = require('stream').Transform;
forge.options.usePureJavaScript = true;
var wclib = require('./WebConnect.js');
var xlib = wclib.xlib;

exports = module.exports = {};

exports.jsHarmonyFactoryAPI = function(jshconfig, options){
  var api_path = jshconfig.path + '/node_modules/jsharmony-factory/api.js';
  if(!fs.existsSync(api_path)){
    //throw new Error('jsharmony-factory module not installed at ' + api_path);
    console.log("\r\njsharmony-factory module not installed at " + api_path);
    console.log("\r\njsharmony-factory required for automatic model generation");
    process.exit(1);
  }
  var jsHarmonyFactoryAPI = require(api_path);
  return new jsHarmonyFactoryAPI(options);
};

exports.jsHarmonyTestAPI = function(jshconfig, options){
  var node_modules = exports.localNodeModulesPath(jshconfig.path);
  if(!node_modules) {
    console.log("\r\nnode_modules could not be found from " + jshconfig.path);
    console.log("\r\njsharmony-test required for screenshot tests");
    process.exit(1);
  }
  var api_path = path.join(node_modules, 'jsharmony-test/api.js');
  if(!fs.existsSync(api_path)){
    console.log("\r\njsharmony-test module not installed at " + api_path);
    console.log("\r\njsharmony-test required for screenshot tests");
    process.exit(1);
  }
  var jsHarmonyTestAPI = require(api_path);
  return new jsHarmonyTestAPI(options);
};

exports.localNodeModulesPath = function(fromPath) {
  var parentPath = fromPath;
  do {
    fromPath = parentPath;
    var node_modules = path.join(fromPath, 'node_modules');
    if(fs.existsSync(node_modules)){
      return node_modules;
    }
    parentPath = path.dirname(fromPath);
  } while (parentPath && parentPath != fromPath);
};

exports.dos2unix = function(txt){
  if(!txt) return;
  return txt.toString().replace(/\r/g, '');
};

exports.copyFile = function(source, target, cb) {
  if (source == '') return exports.tryUnlink(target, cb);

  var cbCalled = false;
  var rd = fs.createReadStream(source);
  rd.on("error", done);
  var wr = fs.createWriteStream(target);
  wr.on("error", done);
  wr.on("close", function (ex) { done(); });
  rd.pipe(wr);
  
  function done(err) {
    if (!cbCalled) { if (typeof err == 'undefined') err = null; cb(err); cbCalled = true; }
  }
};

exports.funcRecursive = function (fpath, filefunc /* (filepath, filerelativepath, cb) */, dirfunc /* (filepath, filerelativepath, cb) */, options, cb, relativepath){
  options = _.extend({ file_before_dir: false, preview_dir: function(fpath, relativepath, dir_cb){ return dir_cb(); } }, options||{});
  if ((fpath[fpath.length - 1] == '/') || (fpath[fpath.length - 1] == '\\')) fpath = fpath.substr(0, fpath.length - 1);
  relativepath = relativepath || '';
  fs.exists(fpath, function (exists) {
    if (!exists) return cb(null);
    fs.readdir(fpath, function (err, files) {
      if (err) return cb(err);
      var skip = false;
      async.waterfall([
        //Pre-directory operation
        function(op_cb){
          if(options.file_before_dir){
            return options.preview_dir(fpath, relativepath, function(dir_err) {
              if (dir_err===false) skip = true;
              if (dir_err) return op_cb(dir_err);
              return op_cb(null);
            });
          }
          if (!dirfunc) return op_cb(null);
          else dirfunc(fpath, relativepath, function (dir_err) {
            if (dir_err===false) skip = true;
            if (dir_err) return op_cb(dir_err);
            return op_cb(null);
          });
        },
        //File operations
        function(op_cb){
          if(skip) return op_cb(null);
          async.eachSeries(files, function (file, files_cb) {
            var filepath = path.join(fpath, file);
            var filerelativepath = path.join(relativepath, file);
            fs.lstat(filepath, function (lstat_err, stats) {
              if (lstat_err) return files_cb(lstat_err);
              if (stats.isDirectory()) {
                exports.funcRecursive(filepath, filefunc, dirfunc, options, files_cb, filerelativepath);
              }
              else {
                if (!filefunc) files_cb();
                else filefunc(filepath, filerelativepath, function (file_err) {
                  if (file_err) return files_cb(file_err);
                  files_cb();
                });
              }
            });
          }, op_cb);
        },
        //Post-directory operation
        function(op_cb){
          if(skip) return op_cb(null);
          if(!options.file_before_dir) return op_cb(null);
          if (!dirfunc) return op_cb(null);
          else dirfunc(fpath, relativepath, function (dir_err) {
            if (dir_err) return op_cb(dir_err);
            return op_cb(null);
          });
        }
      ], cb);
    });
  });
};

exports.copyRecursive = function (source, target, options, cb){
  options = _.extend({
    forEachFile: function(filepath, targetpath, cb){ return cb(true); },
    forEachDir: function(dirpath, targetpath, cb){ return cb(true); }
  }, options);
  return exports.funcRecursive(source, function (filepath, relativepath, file_cb) { //filefunc
    var targetpath = path.join(target, relativepath);
    options.forEachDir(filepath, targetpath, function(copy){
      if(!copy) return file_cb();
      exports.copyFile(filepath, path.join(target, relativepath), file_cb);
    });
  }, function (dirpath, relativepath, dir_cb) { //dirfunc
    var targetpath = path.join(target, relativepath);
    options.forEachDir(dirpath, targetpath, function(create){
      if(!create) return dir_cb(false);
      exports.createFolderIfNotExists(targetpath, dir_cb);
    });
  }, undefined, cb);
};

exports.createFolderIfNotExists = function (path, callback) {
  if (!callback) callback = function () { };
  fs.mkdir(path, '0777', function (err) {
    if (err && err.code == 'EEXIST') return callback(null);
    if (err) return callback(err);
    return callback(null);
  });
};

exports.createFolderRecursive = function (fpath, callback) {
  if (!callback) callback = function () { };
  if(fpath=='.') return callback();
  fpath = path.resolve(fpath);
  fs.exists(fpath, function (exists) {
    if (exists) return callback();
    exports.createFolderRecursive(path.dirname(fpath), function(err){
      if(err) return callback(err);
      fs.mkdir(fpath, '0777', function (err) {
        if (err && err.code == 'EEXIST') return callback(null);
        if (err) return callback(err);
        return callback(null);
      });
    });
  });
};

exports.rmdirRecursiveSync = function (fpath){
  if (fs.existsSync(fpath)) {
    fs.readdirSync(fpath).forEach(function(entry) {
      var entry_path = path.join(fpath, entry);
      if (fs.lstatSync(entry_path).isDirectory()) {
        exports.rmdirRecursiveSync(entry_path);
      } else {
        fs.unlinkSync(entry_path);
      }
    });
    fs.rmdirSync(fpath);
  }
};

exports.unzip = function(zipPath, dest, options, cb){
  options = _.extend({
    onEntry: null //function(entry){} //Return false == do not extract.  Return string = new path
  }, options);
  yauzl.open(zipPath, { lazyEntries: true }, function(err, zipFile){
    if(err) throw err;

    var canceled = false;
    zipFile.on('error', function(err){ canceled = true; cb(err); });
    zipFile.on('close', function(){ if(canceled) return; cb(null); });
    zipFile.on('entry', function(entry){
      if(canceled) return;

      var next = function(){ zipFile.readEntry(); };
      if(entry.fileName.indexOf('__MACOSX/') == 0) return next();

      var targetPath = entry.fileName;
      if(options.onEntry) targetPath = options.onEntry(entry);
      if(targetPath===false) return next();
      if((targetPath===true) || !targetPath) targetPath = entry.fileName;

      async.waterfall([
        function(entry_cb){
          if(dest){
            targetPath = path.join(dest, targetPath);
            var targetFolder = path.dirname(targetPath);
            fs.realpath(targetFolder, function(err, realPath){
              if(err) return entry_cb(err);

              //Check if entry has directory traversal
              var relativePath = path.relative(dest, realPath);
              if(_.includes(relativePath.split(path.sep), '..')) return entry_cb(new Error('Project contains invalid file with directory traversal: '+entry.fileName));

              return entry_cb();
            });
          }
          else {
            targetPath = '';
            return entry_cb();
          }
        },

        function(entry_cb){
          if(!targetPath) return entry_cb();

          //Check if entry has invalid file mode
          var fileMode = (entry.externalFileAttributes >> 16) & 0xFFFF;
          if((fileMode & 61440) == 40960) return entry_cb(new Error('Project contains invalid file with symlink: '+entry.fileName));

          var isFolder = (((fileMode & 61440) == 16384) || (/\/$/.test(targetPath)));
          isFolder = isFolder || (((entry.versionMadeBy >> 8) === 0) && (entry.externalFileAttributes === 16));

          if(isFolder) {
            //Create directory
            exports.createFolderRecursive(targetPath, entry_cb);
          } else {
            //Create parent directory
            exports.createFolderRecursive(path.dirname(targetPath), function(err) {
              if (err) return entry_cb(err);
    
              zipFile.openReadStream(entry, function(err, readStream) {
                if (err) return entry_cb(err);

                //Save file contents
                var writeStream = fs.createWriteStream(targetPath);
                writeStream.on("close", function(){ return entry_cb(); });

                var fileExt = path.extname(targetPath.toLowerCase());
                if(_.includes(['.htm','.html','.js','.css','.txt','.json','.sql','.cmd','.bat','.sh','.gitignore','.md'], fileExt)){
                  //Transform Windows / Unix line breaks
                  var eolTransform = exports.eolTransform();
                  eolTransform.pipe(writeStream);
                  readStream.pipe(eolTransform);
                }
                else {
                  readStream.pipe(writeStream);
                }
              });
            });
          }
        }
      ], function(err){
        if(err) throw err;
        return next();
      });
    });
    zipFile.readEntry();
  });
};

exports.eolTransform = function(){
  return new Transform({
    transform(chunk, encoding, callback) {
      var str = chunk.toString();
      var strout = '';
      var startIdx = 0;
      var chr = '';
      var prevchr = '';
      for(var i=0;i<str.length;i++){
        chr = str[i];
        if(chr=='\n'){
          if(prevchr=='\r'){
            if(global._IS_WINDOWS){ /* OK */}
            else {
              strout += str.substr(startIdx, i-startIdx-1)+'\n';
              startIdx = i+1;
            }
          }
          else {
            if(global._IS_WINDOWS){
              strout += str.substr(startIdx, i-startIdx)+'\r\n';
              startIdx = i+1;
            }
          }
        }
        prevchr = chr;
      }
      strout += str.substr(startIdx);
      callback(null, Buffer.from(strout));
    }
  });
};

exports.getModulePath = function(moduleScript, callback){
  callback = callback || function(err, path){};
  var moduleScriptPath = '';
  var noNode = false;
  xlib.spawn('node',['-e','console.log(require.resolve('+JSON.stringify(moduleScript)+'));'],function(code){
    if(noNode) return;
    if(!moduleScriptPath){ return callback(new Error('ERROR: Module not found: '+moduleScript)); }
    return callback(null, moduleScriptPath);
  },function(data){
    moduleScriptPath = data.trim();
  },undefined,
  function(err){ noNode = true; return callback(new Error('ERROR: Could not find or start command "node". Check to make sure Node.js is installed and is in the global path.')); });
};

exports.runModuleScript = function(moduleScript, params, options, callback){
  callback = callback || function(){};
  exports.getModulePath(moduleScript, function(err, moduleScriptPath){
    if(err){ console.log(err); return; }
    exports.runScript(moduleScriptPath, params, options, callback);
  });
};

exports.runScript = function(script, params, options, callback){
  callback = callback || function(){};
  options = _.extend({ onMessage: undefined /*function(msg, handle){}*/ }, options);
  var cmd = [script].concat(params || []);
  xlib.spawn('node',cmd,function(code){
    callback(code); //0 = success
  },undefined,undefined,
  function(err){ console.log('ERROR: Could not find or start command "node". Check to make sure Node.js is installed and is in the global path.'); },
  { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] },
  options.onMessage);
};

exports.readManifest = function(fpath, cb /* (err, manifest) */){
  fs.readFile(fpath, 'utf8', function(err, data){
    if(err) return cb(err);
    var manifest = {};
    try{
      manifest = JSON.parse(data);
    }
    catch(ex){ return cb(ex); }
    if(!manifest) manifest = {};
    manifest.installer = _.extend({
      "jsharmony_factory": true,
      "jsharmony_factory_client_portal": false,
      "executables": ["app.js"],
      "generate_self_signed_certs": [], //{ "key": "cert/path.to.key", "cert": "cert/path.to.cert" }
      "generate_gitignore": true, //or ['path1','path2','path3']
      "auto_create_database": true,
    }, manifest.installer);
    manifest.installer.scripts = _.extend({
      "pre_install": null,
      "post_install": null,
      "pre_db_create": null,
      "pre_db_init": null,
      "post_db_init": null,
    }, manifest.installer.scripts);
    manifest.dev = _.extend({
      "watch": true, //"jsharmony dev" watch paths: true for project defaults, or ['path1','path2','path3']
    }, manifest.dev);
    return cb(null, manifest);
  });
};

exports.generateSelfSignedCert = function(days, commonName, attrs, extensions){
  var pki = forge.pki;
  var keys = pki.rsa.generateKeyPair(2048);
  var cert = pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  var serial = '00';
  var serialChars = ['1','2','3','4','5','6','7','8','9','A','B','C','E','D','F'];
  for(var i=0;i<32;i++) serial += serialChars[Math.min(Math.floor(Math.random()*15),14)];
  cert.serialNumber = serial;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date((new Date()).getTime()+days*60*60*24*1000);
  
  attrs = _.extend({
    commonName: commonName,
    countryName: 'US',
    stateOrProvinceName: 'IL',
    localityName: 'Bartlett',
    organizationName: 'jsHarmony',
    organizationalUnitName: 'IT',
  }, attrs);
  var certAttrs = [];
  for(let key in attrs){
    certAttrs.push({ name: key, value: attrs[key] });
  }
  cert.setSubject(certAttrs);
  cert.setIssuer(certAttrs);

  extensions = _.extend({
    basicConstraints: { cA:true },
    keyUsage: { keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
    extKeyUsage: { serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true },
    nsCertType: { client: true, server: true, email: true, objsign: true, sslCA: true, emailCA: true, objCA: true },
    subjectAltName: { altNames: [{ type: 2, value: commonName }] }
  }, extensions);
  var certExtensions = [];
  for(let key in extensions){
    certExtensions.push(_.extend({ name: key }, extensions[key]));
  }
  cert.setExtensions(certExtensions);

  cert.sign(keys.privateKey);

  var key_pem = pki.privateKeyToPem(keys.privateKey);
  var cert_pem = pki.certificateToPem(cert);

  return {
    key: key_pem,
    cert: cert_pem
  };
};