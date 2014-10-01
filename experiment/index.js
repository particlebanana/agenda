/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');
var async = require('async');
var Agenda = require('../');
var Waterline = require('./setup-datastore');


var agenda;

Waterline({}, function (err, wl1orm){
  if (err) throw err;

  agenda = new Agenda({
    model: wl1orm.collections.agendajobs,
    processEvery: '1 second',
    maxConcurrency: 3,
    defaultConcurrency: 1
  });

  agenda.define('holla', {concurrency: 1, lockLifetime: 5000}, function(job, done) {
    console.log('job  (%s)', job.attrs.data.someId);
    setTimeout(function (){
      console.log('finished    (%s)', job.attrs.data.someId);
      done();
    }, 150);
  });

  agenda.define('job which spawns other jobs', {lockLifetime: 5000}, function(job, done) {
    console.log('running "job which spawns other jobs"...');
    async.each(_.range(1,10), function (i, next) {
      setTimeout(function (){
        agenda.schedule(new Date((new Date()).getTime()+1000), 'holla', { someId: 'NEW'+i} );
        next();
      }, 250*i);
    }, function afterwards(err){
      if (err) return done(err);
      return done();
    });
  });

  agenda.every('15 seconds', 'job which spawns other jobs');


  agenda.start();
  console.log('Starting agenda...');







  function graceful() {
    console.log('Stopping agenda...');
    agenda.stop(function() {
      process.exit(0);
    });
  }
  process.on('SIGTERM', graceful);
  process.on('SIGINT' , graceful);
});

