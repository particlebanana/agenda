/**
 * Module dependencies
 */

var Agenda = require('../');
var _ = require('lodash');
var async = require('async');
var Waterline = require('./setup-datastore');


var agenda;

Waterline({}, function (err, wl1orm){
  if (err) throw err;

  agenda = new Agenda({
    // db: {
    //   address: 'localhost:27017/agenda-example3'
    // },

    model: (function hack_to_provide_upsert_functionality(model){
      model.upsert = function (criteria, values, cb) {
        console.warn('i dont actually do upserts na na na na na naaaa');
        cb();
      };
      return model;
    })(wl1orm.collections.agendajobs),

    processEvery: '1 second'
  });

  agenda.maxConcurrency(3);
  agenda.defaultConcurrency(2);

  // agenda.define('holla', {concurrency: 1, lockLifetime: 5000}, function(job, done) {
  //   console.log('job  (%s)', job.attrs.data.someId);
  //   setTimeout(function (){
  //     console.log('finished    (%s)', job.attrs.data.someId);
  //     done();
  //   }, 150);
  // });

  // agenda.define('job which spawns other jobs', {lockLifetime: 5000}, function(job, done) {
  //   console.log('running "job which spawns other jobs"...');
  //   // console.log('(job type: %s)',job.attrs._id);

  //   async.each(_.range(1,10), function (i, next) {
  //     setTimeout(function (){
  //       agenda.schedule(new Date((new Date()).getTime()+1000), 'holla', { someId: 'NEW'+i} );
  //       next();
  //     }, 250*i);
  //   }, function afterwards(err){
  //     if (err) return done(err);
  //     return done();
  //   });
  // });

  // agenda.every('5 seconds', 'job which spawns other jobs');

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

