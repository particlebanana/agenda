/**
 * Module dependencies
 */

var Agenda = require('../');




var agenda = new Agenda({
  db: {
    address: 'localhost:27017/agenda-example3'
  },
  processEvery: '1 second'
});

agenda.maxConcurrency(3);
agenda.defaultConcurrency(2);

// Teach this agenda process how to "holla"
agenda.define('holla', {concurrency: 1, lockLifetime: 5000}, function(job, done) {
  console.log('job  (%s)', job.attrs.data.someId);
  setTimeout(function (){
    console.log('finished    (%s)', job.attrs.data.someId);
    done();
  }, 150);
});

agenda.start();
console.log('Starting agenda (slave)...');



function graceful() {
  console.log('Stopping agenda...');
  agenda.stop(function() {
    process.exit(0);
  });
}
process.on('SIGTERM', graceful);
process.on('SIGINT' , graceful);
