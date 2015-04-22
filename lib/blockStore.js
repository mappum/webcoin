var levelup = require('levelup');
var mkdirp = require('mkdirp');
var bitcore = require('bitcore');
var u = require('./utils.js');

var BlockStore = module.exports = function(opts) {
  opts = opts || {};
  if(!opts.path) throw new Error('"path" option is required for BlockStore');
  if(!process.browser) mkdirp.sync(opts.path);
  if(!opts.db) {
    opts.db = process.browser ? require('level-js') : require('leveldown');
  }
  this.db = levelup(opts.path, opts);
};

BlockStore.prototype.putHeader = function(header, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  var self = this;
  this.db.put(u.formatHash(header.hash), JSON.stringify(header.toJSON()), function(err) {
    if(err) return cb(err);
    if(opts.tip) {
      if(opts.height == null) return cb(new Error('Must specify height when putting tip header'));
      self._setTip({ height: opts.height, hash: header.hash }, cb);
    }
    else cb(null);
  });
};

BlockStore.prototype.getHeader = function(hash, cb) {
  this.db.get(u.formatHash(hash), function(err, header) {
    if(err) return cb(err);
    header = JSON.parse(header);
    cb(null, bitcore.BlockHeader.fromJSON(header));
  });
};

BlockStore.prototype._setTip = function(tip, cb) {
  this.db.put('tip', JSON.stringify(tip), cb);
};

BlockStore.prototype.getTip = function(cb) {
  var self = this;
  this.db.get('tip', function(err, tip) {
    if(err) return cb(err);
    try { tip = JSON.parse(tip); }
    catch(err) { return cb('Invalid tip value: '+err); }

    self.getHeader(tip.hash, function(err, header) {
      if(err) return cb(err);
      tip.hash = u.toHash(tip.hash);
      tip.header = header;
      cb(null, tip);
    });
  });
};
