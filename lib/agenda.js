/**
 * Module dependencies
 */

var utils = require('util');
var Emitter = require('events').EventEmitter;
var humanInterval = require('human-interval');
var Job = require('./job.js');
var util = require('util');
// var mongo = require('mongoskin');



var Agenda = module.exports = function Agenda(config) {
  if (!(this instanceof Agenda)) return new Agenda(config);
  if (!config) config = {};
  this._name = config.name;
  this._processEvery = humanInterval(config.processEvery) || humanInterval('5 seconds');
  this._defaultConcurrency = config.defaultConcurrency || 5;
  this._maxConcurrency = config.maxConcurrency || 20;
  this._definitions = {};
  this._runningJobs = [];
  this._jobQueue = [];
  this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; //10 minute default lockLifetime

  ////////////////////////////////////////////////////////////////////////
  // TODO
  // If `db` or `mongo` was provided, default to mongo, support traditional
  // config for backwards compat.
  if (config.db) {
    throw new Error('`db` option is not currently supported. Please provide a pre-existing, instantiated Waterline model as the `model` option.');
  }
  //
  // if (config.db)
  //   this.database(config.db.address, config.db.collection);
  // else if (config.mongo)
  //   this._db = config.mongo;
  ////////////////////////////////////////////////////////////////////////

  if (!config.model) {
    // TODO: default to use waterline's local disk adapter with a conventional model+connection(/datastore)
    // TODO: also- do the actual database setup and teardown
    throw new Error('friendly default setup is not ready yet! Please provide a pre-existing, instantiated Waterline model as the `model` option.');
  }

  // Just a little duck-typing for a better user experience:
  if (typeof config.model !== 'object' || !config.model.update || !config.model.create) {
    throw new Error('Provided `model` is not valid');
  }
  this._model = config.model;

};

// Agenda instances are also event emitters.
utils.inherits(Agenda, Emitter);



// Configuration Methods

////////////////////////////////////////////////////////////////////////
// TODO
// Support traditional mongo config methods for backwards compat.

// Agenda.prototype.mongo = function(db) {
//   this._db = db;
//   return this;
// };

// Agenda.prototype.database = function(url, collection) {
//   collection = collection || 'agendaJobs';
//   if (!url.match(/^mongodb:\/\/.*/)) {
//     url = 'mongodb://' + url;
//   }

//   this._db = mongo.db(url, {
//     w: 0
//   }).collection(collection);

//   ignoreErrors = function() {};
//   this._db.ensureIndex("nextRunAt", ignoreErrors)
//     .ensureIndex("lockedAt", ignoreErrors)
//     .ensureIndex("name", ignoreErrors)
//     .ensureIndex("priority", ignoreErrors);

//   return this;
// };
////////////////////////////////////////////////////////////////////////


Agenda.prototype.name = function(name) {
  this._name = name;
  return this;
};

Agenda.prototype.processEvery = function(time) {
  this._processEvery = humanInterval(time);
  return this;
};

Agenda.prototype.maxConcurrency = function(num) {
  this._maxConcurrency = num;
  return this;
};

Agenda.prototype.defaultConcurrency = function(num) {
  this._defaultConcurrency = num;
  return this;
};

Agenda.prototype.defaultLockLifetime = function(ms) {
  this._defaultLockLifetime = ms;
  return this;
};

// Job Methods
Agenda.prototype.create = function(name, data) {
  var priority = this._definitions[name] ? this._definitions[name].priority : 0;
  var job = new Job({
    name: name,
    data: data,
    type: 'normal',
    priority: priority,
    agenda: this
  });
  return job;
};


////////////////////////////////////////////////////////////////////////
// TODO
// Support `.jobs()` method for backwards compat.


// Agenda.prototype.jobs = function() {
//   var args = Array.prototype.slice.call(arguments);

//   if (typeof args[args.length - 1] == 'function') {
//     args.push(findJobsResultWrapper(this, args.pop()));
//   }

//   return this._db.findItems.apply(this._db, args);
// };
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
// TODO
// Support `.purge()` method for backwards compat.

// Agenda.prototype.purge = function(cb) {
//   var definedNames = Object.keys(this._definitions);
//   this._db.remove({
//     name: {
//       $not: {
//         $in: definedNames
//       }
//     }
//   }, cb);
// };
////////////////////////////////////////////////////////////////////////



Agenda.prototype.define = function(name, options, processor) {
  if (!processor) {
    processor = options;
    options = {};
  }
  this._definitions[name] = {
    fn: processor,
    concurrency: options.concurrency || this._defaultConcurrency,
    priority: options.priority || 0,
    lockLifetime: options.lockLifetime || this._defaultLockLifetime,
    running: 0
  };
};

Agenda.prototype.every = function(interval, names, data) {
  var self = this;

  if (typeof names === 'string') {
    return createJob(interval, names, data);
  } else if (Array.isArray(names)) {
    return createJobs(interval, names, data);
  }

  function createJob(interval, name, data) {
    var job;
    job = self.create(name, data);
    job.attrs.type = 'single';
    job.repeatEvery(interval);
    job.save();
    return job;
  }

  function createJobs(interval, names, data) {
    return names.map(function(name) {
      return createJob(interval, name, data);
    });
  }
};

Agenda.prototype.schedule = function(when, names, data) {
  var self = this;

  if (typeof names === 'string') {
    return createJob(when, names, data);
  } else if (Array.isArray(names)) {
    return createJobs(when, names, data);
  }

  function createJob(when, name, data) {
    var job = self.create(name, data);
    job.schedule(when);
    job.save();
    return job;
  }

  function createJobs(when, names, data) {
    return names.map(function(name) {
      return createJob(when, name, data);
    });
  }
};

Agenda.prototype.now = function(name, data) {
  var job = this.create(name, data);
  job.schedule(new Date());
  job.save();
  return job;
};

Agenda.prototype.cancel = function(query, cb) {
  return this._model.destroy(query, cb);
};

Agenda.prototype.saveJob = function(job, cb) {
  var self = this;

  var props = job.toJSON();
  var id = job.attrs.id;
  delete props.id;

  props.lastModifiedBy = this._name;

  var now = new Date();
  var protect = {};
  var update = {
    $set: props
  };

  // If the job id is known, update it
  if (id) {
    // console.log('                     UPDATING JOB... (%s, named "%s", someId=>%s)',id, job.attrs.name, (job.attrs.data&&job.attrs.data.someId));
    // console.log('                     (props: %s)', util.inspect(props, false, null));
    this._model.update(id, props, processDbResult);

    // this._db.findAndModify({
    //   _id: id
    // }, {}, update, {
    //   new: true
    // }, processDbResult);
  }

  // If the job is "single", try a transactional upsert
  // (i.e. "update if it exists, otherwise create")
  else if (props.type == 'single') {

    // console.log('                     UPSERTING JOB... (named "%s", someId=>%s)', job.attrs.name, (job.attrs.data&&job.attrs.data.someId));

    ////////////////////////////////////////////////////////////////////////////////////////
    // TODO:
    // Ensure the following is transactional (~mike)

    // if (props.nextRunAt && props.nextRunAt <= now) {
    //   protect.nextRunAt = props.nextRunAt;
    //   delete props.nextRunAt;
    // }
    // if (Object.keys(protect).length > 0) {
    //   update.$setOnInsert = protect;
    // }
    ////////////////////////////////////////////////////////////////////////////////////////

    var Model = this._model;
    Model.count({
      name: props.name,
      type: 'single'
    }, function (err, numJobs) {
      if (err) return processDbResult(err);

      // If `nextRunAt` is in the past, then omit it from the new values object (`props`),
      // and then if the upsert ends up causing a `create`, set `nextRunAt` (otherwise leave it alone)

      // update...
      if (numJobs > 0) {
        Model.update({
          name: props.name,
          type: 'single'
        }, (function(values){
          if (values.nextRunAt && values.nextRunAt <= now) {
            delete values.nextRunAt;
          }
          return values;
        })(props), processDbResult);
        return;
      }

      // ...or create.
      Model.create(props, function (err, newRecord){
        if (err) return processDbResult(err);
        return processDbResult(null, [newRecord]);
      });
    });


    ////////////////////////////////////
    ///(simplified)
    ////////////////////////////////////
    // this._model.upsert({
    //   name: props.name,
    //   type: 'single'
    // }, props, processDbResult);
    ////////////////////////////////////

    // Try an upsert.
    // this._db.findAndModify({
    //   name: props.name,
    //   type: 'single'
    // }, {}, update, {
    //   upsert: true,
    //   new: true
    // }, processDbResult);
  }

  // Otherwise just create a new record for the job.
  else {
    // console.log('                     CREATING NEW JOB... (named "%s", someId=>%s)', job.attrs.name, (job.attrs.data&&job.attrs.data.someId));
    this._model.create(props, processDbResult);

    // this._db.insert(props, processDbResult);
  }

  function processDbResult(err, record){

    // Before negotiating error...
    try {

      // Coerce database result set into a single record, if it isn't already:
      if (typeof record === 'object' && Array.isArray(record)) {
        record = record[0];
      }

      // Update in-memory `job`
      job.attrs.id = record.id;
      job.attrs.nextRunAt = record.nextRunAt;

    }
    catch (e) {}

    // Pass error to callback if we have one, otherwise just throw.
    if (err) {
      if (cb) return cb(err, job);
      throw err;
    }

    // Finally, call `processJobs` if
    if (job.attrs.nextRunAt && job.attrs.nextRunAt < self._nextScanAt) {
      processJobs.call(self, job);
    }

    // Trigger optional callback on success
    if (cb) return cb(null, job);

  }

  // Original version of `processDbResult`:
  //
  // fn = cb;
  // function processDbResult(err, res) {
  //   if (err) throw (err);
  //   else if (res) {
  //     if (Array.isArray(res)) {
  //       res = res[0];
  //     }

  //     job.attrs._id = res._id;
  //     job.attrs.nextRunAt = res.nextRunAt;

  //     if (job.attrs.nextRunAt && job.attrs.nextRunAt < self._nextScanAt)
  //       processJobs.call(self, job);
  //   }

  //   if (fn) {
  //     fn(err, job);
  //   }
  // }
};





// Job Flow Methods

Agenda.prototype.start = function() {
  if (!this._processInterval) {
    this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
    process.nextTick(processJobs.bind(this));
  }
};

Agenda.prototype.stop = function(cb) {
  cb = cb || function() {};
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  unlockJobs.call(this, cb);
};

/**
 * Find and lock jobs
 * @param {String} jobName
 * @param {Function} cb
 * @protected
 */
Agenda.prototype._findAndLockNextJob = function(jobName, definition, cb) {
  var now = new Date();
  var lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);


  // NOTE: Waterline's `update` behaves like `findAndModify`, but as if the `new` option
  // was set to true.
  this._model.update({
    where: {

      // Waterline thinks `null` is <= everything.
      nextRunAt: {
        '!': null
      },
      name: jobName,

      or: [
        {
          nextRunAt: {
            '<=': this._nextScanAt
          },
          lockedAt: null
        },
        // NOTE: made an assumption here that !$exists === null
        // (this should be true for all Waterline adapters, but should double-check;
        // and definitely worth a notable point to track here)
        {
          nextRunAt: {
            '<=': this._nextScanAt
          },
          lockedAt: {
            '<=': lockDeadline
          }
        }
      ]
    },
    sort: {
      priority: -1
    }
  },
  {
    lockedAt: now
  },
    // Reminder: this function builds and returns a thunk for our callback (`cb`)
    (findJobsResultWrapper(this, cb))
  );



  // this._db.findAndModify({
  //     nextRunAt: {
  //       $lte: this._nextScanAt
  //     },
  //     $or: [{
  //       lockedAt: null
  //     }, {
  //       lockedAt: {
  //         $exists: false
  //       }
  //     }, {
  //       lockedAt: {
  //         $lte: lockDeadline
  //       }
  //     }],
  //     name: jobName
  //   }, {
  //     'priority': -1
  //   }, {
  //     $set: {
  //       lockedAt: now
  //     }
  //   }, {
  //     'new': true
  //   },
  //   findJobsResultWrapper(this, cb)
  // );
};

/**
 *
 * @param agenda
 * @param cb
 * @return {Function}
 * @private
 */
function findJobsResultWrapper(agenda, cb) {
  return function(err, jobs) {
    if (err) return cb(err, jobs);
    if (!jobs) return cb(err, jobs);

    //query result **USED TO BE** either an array or one record,
    //so this code handles both cases:
    if (jobs instanceof Array) {
      jobs = jobs.map(createJob.bind(null, agenda));
      return cb(null, jobs);
    }

    // otherwise...
    jobs = createJob(agenda, jobs);
    return cb(null, jobs);
  };
}

/**
 * Create Job object from data
 * @param {Object} agenda
 * @param {Object} jobData
 * @return {Job}
 * @private
 */
function createJob(agenda, jobData) {
  jobData.agenda = agenda;
  return new Job(jobData);
}

function unlockJobs(done) {
  function getJobId(j) {
    return j.attrs.id;
  }
  var jobIds = this._jobQueue.map(getJobId)
    .concat(this._runningJobs.map(getJobId));

  this._model.update({
    id: jobIds
  }, {
    lockedAt: null
  }, done);

  // this._db.update({
  //   _id: {
  //     $in: jobIds
  //   }
  // }, {
  //   $set: {
  //     lockedAt: null
  //   }
  // }, {
  //   multi: true
  // }, done);
}

function processJobs(extraJob) {
  if (!this._processInterval) return;
  var definitions = this._definitions,
    jobName,
    jobQueue = this._jobQueue,
    self = this;

  if (!extraJob) {
    for (jobName in definitions) {
      jobQueueFilling(jobName);
    }
  } else {
    // On the fly lock a job
    var now = new Date();
    self._model.update({
      id: extraJob.attrs.id,
      lockedAt: null
    }, {
      lockedAt: now
    }, function (err, updatedJobs) {
      if (err) {
        // TODO: touch base w/ ryan to see if/how we should be explicitly
        // handling this error here (and whether it's safe to do what I'm doing here--
        // i.e. removing the `if (resp)` check in favor of `if (err)`)
        return;
      }

      // In Waterline, `updatedJobs` will always be set-- it will be an array, where an item exists
      // for each record that was updated.  If no records were matched, it will be an empty array.
      if (!updatedJobs.length) {
        return;
      }

      // If we acquired a lock, dequeue the job and start processing it.
      jobQueue.unshift(extraJob);
      jobProcessing();
    });

    // self._db.findAndModify({
    //   _id: extraJob.attrs._id,
    //   lockedAt: null
    // }, {}, {
    //   $set: {
    //     lockedAt: now
    //   }
    // }, function(err, resp) {
    //   if (resp) {
    //     jobQueue.unshift(extraJob);
    //     jobProcessing();
    //   }
    // });
  }

  function jobQueueFilling(name) {
    var now = new Date();
    self._nextScanAt = new Date(now.valueOf() + self._processEvery);
    self._findAndLockNextJob(name, definitions[name], function(err, jobs) {
      if (err) {
        // Is this a good idea...?
        throw err;
      }

      if (jobs.length > 0) {
        jobQueue.unshift(jobs[0]);
        jobQueueFilling(name);
        jobProcessing();
      }
    });
  }

  function jobProcessing() {
    if (!jobQueue.length) {
      return;
    }

    var now = new Date();

    var job = jobQueue.pop();
    var name = job.attrs.name;
    var jobDefinition = definitions[name];

    if (job.attrs.nextRunAt < now) {
      runOrRetry();
    } else {
      setTimeout(runOrRetry, job.attrs.nextRunAt - now);
    }

    function runOrRetry() {
      if (self._processInterval) {
        if (jobDefinition.concurrency > jobDefinition.running &&
          self._runningJobs.length < self._maxConcurrency) {

          self._runningJobs.push(job);
          jobDefinition.running++;

          job.run(processJobResult);
          jobProcessing();
        } else {
          // Put on top to run ASAP
          jobQueue.push(job);
        }
      }
    }
  }

  function processJobResult(err, job) {
    if (err) throw err;
    if (!job) throw new Error('Job went missing! `job` => '+require('util').inspect(job, false, null));
    var name = job.attrs.name;

    self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
    definitions[name].running--;

    jobProcessing();
  }
}
