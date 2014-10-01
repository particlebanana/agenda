module.exports = function Driver (){

  // This should be replaced w/ a waterline model asap.
  // Just a placeholder to track how everything works.

  return {

    destroy: function (options, cb){
      // • remove(query, cb)

      // return this._db.remove(query, cb);
      return cb(new Error('TODO'));
    },

    update: function (options, cb){
      // • findAndModify(....,{new:true})
      // • update(...., {multi: true})

      cb(new Error('TODO'));
    },


    create: function (options, cb){
      // • insert

      cb(new Error('TODO'));
    },

    upsert: function (options, cb){
      // • findAndModify(...., {new:true, upsert: true})

      //TODO: ensure atomicity
      //(which is not currently taken into account in my shim implementation here!)
      cb(new Error('TODO'));
    }

  };

};
