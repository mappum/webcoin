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

BlockStore.prototype.put = function(block, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(block.height == null) return cb(new Error('Must specify height'));
  if(opts.tip) opts.best = true;

  var self = this;
  var blockJson = JSON.stringify({
    height: block.height,
    header: block.header.toJSON()
  });
  var batch = [
    { type: 'put', key: u.formatHash(block.header.hash), value: blockJson }
  ];
  if(opts.best && opts.prev) {
    var prevJson = JSON.stringify({
      height: opts.prev.height,
      header: opts.prev.header.toJSON(),
      next: block.header.hash
    });
    batch.push({ type: 'put', key: u.formatHash(opts.prev.hash), value: prevJson });
  }
  this.db.batch(batch, function(err) {
      if(err) return cb(err);
      if(opts.tip) {
        return self._setTip({ height: block.height, hash: block.header.hash }, cb);
      }
      cb(null);
    });
};

BlockStore.prototype.get = function(hash, cb) {
  this.db.get(u.formatHash(hash), function(err, block) {
    if(err) return cb(err);
    try { block = JSON.parse(block); }
    catch(err) { return cb(new Error('Error parsing header:' + err)); }
    block.header = bitcore.BlockHeader.fromJSON(block.header);
    cb(null, block);
  });
};

BlockStore.prototype._setTip = function(tip, cb) {
  var newTip = {};
  for(var k in tip) newTip[k] = tip[k];
  delete newTip.header;
  this.db.put('tip', JSON.stringify(newTip), cb);
};

BlockStore.prototype.getTip = function(cb) {
  var self = this;
  this.db.get('tip', function(err, tip) {
    if(err) return cb(err);
    try { tip = JSON.parse(tip); }
    catch(err) { return cb('Invalid tip value: '+err); }

    self.get(u.formatHash(tip.hash), function(err, block) {
      if(err) return cb(err);
      tip.hash = u.toHash(tip.hash);
      tip.header = block.header;
      cb(null, tip);
    });
  });
};
