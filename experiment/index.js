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
    // db: {
    //   address: 'localhost:27017/agenda-example3'
    // },

    model: (function hack_to_provide_upsert_functionality(_model){

      var model = {};
      model.find = _.bind(_model.find, _model);
      model.destroy = function (criteria, cb) {
        console.warn('** DESTROY: ', util.inspect(Array.prototype.slice.call(arguments, 0, -1), false, null), '\n');
        return _model.destroy(criteria, function(err, results){
          console.log('RESULTS:',err,results);
          return cb(err, results);
        });
      };
      model.create = function (values, cb){
        console.warn('** CREATE: ', util.inspect(Array.prototype.slice.call(arguments, 0, -1), false, null), '\n');
        return _model.create(values, function(err, result){
          console.log('RESULT:',err,result);

          // Make sure `_id` is there
          result._id = result._id || result.id;

          return cb(err, result);
        });
      };

      model.update = function (criteria, values, cb) {
        console.warn('** UPDATE: ', util.inspect(criteria, false, null), '\n|||||||||\n', util.inspect(values, false, null), '\n');

        return _model.update(criteria, values).exec(function (err, results) {
          console.log('RESULTS:',err,results);
          if (err) return cb(err);

          // Make sure `_id` is there
          results = _.map(results, function (record){
            record._id = record._id || record.id;
            return record;
          });

          return cb(null, results);
        });
      };
      // model.upsert = function (criteria, values, cb) {
      //   console.warn('** UPSERT: ', util.inspect(criteria, false, null), '\n|||||||||\n', util.inspect(values, false, null), '\n');

      //   // ::update-or-create::
      //   _model.find(criteria, function (err, records) {
      //     if (err) return cb(err);

      //     // update
      //     if (records.length) {
      //       model.update(criteria, values, function (err, records) {
      //         console.log('UPSERT (updated)=> RESULTS:',err,records);
      //         if (err) return cb(err);
      //         return cb(null, records);
      //       });
      //       return;
      //     }

      //     // or create
      //     model.create(values, function (err, newRecord) {
      //       console.log('UPSERT (created)=> RESULTS:',err,[newRecord]);
      //       if (err) return cb(err);
      //       return cb(null, [newRecord]);
      //     });
      //     return;

      //   });
      //   return;
      // };
      return model;
    })(wl1orm.collections.agendajobs),

    processEvery: '1 second'
  });

  agenda.maxConcurrency(3);
  agenda.defaultConcurrency(2);

  // agenda.define('holla', {concurrency: 1, lockLifetime: 5000}, function(job, done) {
  //   console.log('!!');
  //   console.log('job  (%s)', job.attrs.data.someId);
  //   setTimeout(function (){
  //     console.log('finished    (%s)', job.attrs.data.someId);
  //     done();
  //   }, 150);
  // });

  agenda.define('job which spawns other jobs', {lockLifetime: 5000}, function(job, done) {
    console.log('\n!!!!!!!!!!!!','\n@@@@@@@@@@@@@@@@@@@@','\n running "job which spawns other jobs"...\n','@@@@@@@@@@@@@@@@@\n!!!!!!!!!!!!!!!!!!\n');
    return done();
  });

  agenda.every('5 seconds', 'job which spawns other jobs');

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
