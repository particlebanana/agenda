/**
 * Module Dependencies
 */

var _ = require('lodash');
var Waterline = require('waterline');


/**
 * [exports description]
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */
module.exports = function setup_datastore(options, cb) {

  // Specify a WL1.0 ontology object
  bootstrapWaterline({

    // (i.e. buckets of static functions which map to underlying datastore)
    adapters: (function (){
      return {
        'sails-disk': require('sails-disk')
      };
    })(),

    // (i.e. datastore configurations)
    connections: (function (){
      return {
        localDiskDb: {
          adapter: 'sails-disk'
        }
      };
    })(),

    // (i.e. data models)
    collections: (function (){
      return {
        agendaJobs: {
          connection: 'localDiskDb'
        }
      };
    })()

  }, function(err, odm) {
    if (err) return cb(err);
    return cb(null, odm);
  });

};




//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
/// || ||
/// \/ \/
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// TODO:
// pull this accessor into Waterline core for simpler
// direct use
// (~mike)
//////////////////////////////////////////////////////


/**
 * Set up Waterline with the specified
 * models, connections, and adapters.

  @param options
    :: {Object}   adapters     [i.e. a dictionary]
    :: {Object}   connections  [i.e. a dictionary]
    :: {Object}   collections  [i.e. a dictionary]

  @param  {Function} cb
    () {Error} err
    () ontology
      :: {Object} collections
      :: {Object} connections

  @return {Waterline}
 */

function bootstrapWaterline( options, cb ) {

  var adapters = options.adapters || {};
  var connections = options.connections || {};
  var collections = options.collections || {};



  _(adapters).each(function (def, identity) {
    // Make sure our adapter defs have `identity` properties
    def.identity = def.identity || identity;
  });


  var extendedCollections = [];
  _(collections).each(function (def, identity) {

    // Make sure our collection defs have `identity` properties
    def.identity = def.identity || identity;
    // Make sure our collection defs have `tableName` properties
    def.tableName = def.tableName || def.identity;

    // Fold object of collection definitions into an array
    // of extended Waterline collections.
    extendedCollections.push(Waterline.Collection.extend(def));
  });


  // Instantiate Waterline and load the already-extended
  // Waterline collections.
  var waterline = new Waterline();
  extendedCollections.forEach(function (collection) {
    waterline.loadCollection(collection);
  });


  // Initialize Waterline
  // (and tell it about our adapters)
  waterline.initialize({
    adapters: adapters,
    connections: connections
  }, cb);

  return waterline;
}

