/**
 * Module dependencies
 */

var Agenda = require('../');




var agenda = new Agenda({
  db: {
    address: 'localhost:27017/agenda-example3'
  }
});

agenda.define('delete old users', {lockLifetime: 5000}, function(job, done) {
  console.log('job ran...');
  console.log('(job type: %s)',job.attrs._id);
  done();
});

agenda.every('3 seconds', 'delete old users');

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
