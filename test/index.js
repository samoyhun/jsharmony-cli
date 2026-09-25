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

var child_process = require('child_process');
var exec = child_process.exec;
var assert = require('assert');

describe('Output to STDOUT',function(){
  it('Display Usage', function (done) {
    exec('node index.js',function(error,stdout,stderr){
      assert(!error,'Error');
      assert(stdout.indexOf('Usage') >= 0,'Usage text displayed');
      done();
    });
  });
});

describe('Dev command',function(){
  it('Display help', function (done) {
    exec('node index.js',function(error,stdout,stderr){
      assert(!error,'Error');
      assert(stdout.indexOf('dev [SCRIPT]') >= 0,'Dev command listed in usage text');
      done();
    });
  });
  it('Report missing app script', function (done) {
    exec('node index.js dev ./does-not-exist.js',function(error,stdout,stderr){
      assert(!error,'Error');
      assert(stdout.indexOf('App script not found') >= 0,'Missing script reported');
      done();
    });
  });
  it('Reject missing option value', function (done) {
    exec('node index.js dev --exclude',function(error,stdout,stderr){
      assert((stdout+stderr).indexOf('Missing value: --exclude') >= 0,'Missing value reported');
      done();
    });
  });
});
