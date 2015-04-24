var levelup = require('levelup');
var mkdirp = require('mkdirp');
var bitcore = require('bitcore');
var buffertools = require('buffertools');
var u = require('./utils.js');

if(process.browser) {
  require('setimmediate');
}

function cloneBuffer(a) {
  var b = new Buffer(a.length);
  a.copy(b);
  return b;
}

function encodeKey(hash) {
  if(Buffer.isBuffer(hash)) return buffertools.reverse(cloneBuffer(hash)).toString('base64');
  if(typeof hash === 'string') {
    if(hash.length === 44) return hash;
    if(hash.length === 64) return new Buffer(hash, 'hex').toString('base64');
  }
  throw new Error('Invalid hash format');
}

var BlockStore = module.exports = function(opts) {
  opts = opts || {};
  if(!opts.path) throw new Error('"path" option is required for BlockStore');
  if(!process.browser) mkdirp.sync(opts.path);
  if(!opts.db) {
    opts.db = process.browser ? require('level-js') : require('leveldown');
  }
  this.db = levelup(opts.path, opts);

  if(opts.buffer) {
    this.buffer = {};
    this.bufferTip = null;
    this.bufferInterval = null;
    this._startBufferWorker();
  }
};

BlockStore.prototype.put = function(block, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(block.height == null) return cb(new Error('Must specify height'));
  if(opts.tip) {
    opts.best = true;
    var tip = { height: block.height, hash: block.header.hash };
  }

  var self = this;
  var blockJson = JSON.stringify({
    height: block.height,
    header: block.header.toBuffer().toString('base64')
  });
  var batch = [
    { type: 'put', key: encodeKey(block.header.hash), value: blockJson }
  ];
  if(opts.best && opts.prev) {
    var prevJson = JSON.stringify({
      height: opts.prev.height,
      header: opts.prev.header.toBuffer().toString('base64'),
      next: block.header.hash
    });
    batch.push({ type: 'put', key: encodeKey(opts.prev.hash), value: prevJson });
  }

  if(this.buffer) {
    batch.forEach(function(put) {
      self.buffer[put.key] = put.value;
    });
    if(opts.tip) this.bufferTip = tip;
    return setImmediate(cb);
  }

  this.db.batch(batch, function(err) {
    if(err) return cb(err);
    if(opts.tip) return self._setTip(tip, cb);
    cb(null);
  });
};

BlockStore.prototype.get = function(hash, cb) {
  hash = encodeKey(hash);
  
  if(this.buffer) {
    var block = this.buffer[hash];
    if(block) return parseBlock(block);
  }

  this.db.get(hash, function(err, block) {
    if(err) return cb(err);
    parseBlock(block);
  });

  function parseBlock(block) {
    try { block = JSON.parse(block); }
    catch(err) { return cb('Invalid header value: '+err); }
    var header = new Buffer(block.header, 'base64');
    block.header = bitcore.BlockHeader.fromBuffer(header);
    cb(null, block);
  }
};

BlockStore.prototype._setTip = function(tip, cb) {
  var newTip = {};
  for(var k in tip) newTip[k] = tip[k];
  delete newTip.header;

  if(this.buffer) {
    this.bufferTip = newTip;
    return cb(null);
  }

  this.db.put('tip', JSON.stringify(newTip), cb);
};

BlockStore.prototype.getTip = function(cb) {
  var self = this;

  if(this.bufferTip) return getHeader(this.bufferTip);

  this.db.get('tip', function(err, tip) {
    if(err) return cb(err);
    try { tip = JSON.parse(tip); }
    catch(err) { return cb('Invalid tip value: '+err); }
    getHeader(tip);
  });

  function getHeader(tip) {
    self.get(tip.hash, function(err, block) {
      if(err) return cb(err);
      block.hash = u.toHash(block.header.hash);
      cb(null, block);
    });
  }
};

BlockStore.prototype._flushBuffer = function(cb) {
  var self = this;

  if(!cb) {
    cb = function(err) {
      if(err) self.emit('error', err);
    };
  }

  var batch = [];
  for(var k in this.buffer) {
    batch.push({ type: 'put', key: k, value: this.buffer[k] });
  }
  if(this.bufferTip) {
    batch.push({ type: 'put', key: 'tip', value: JSON.stringify(this.bufferTip) });
  }
  if(batch.length === 0) return;

  console.log('flushing buffer')

  this.flushing = true;

  this.db.batch(batch, function(err) {
    self.flushing = false;
    if(err) return cb(err);
    self.buffer = {};
    self.bufferTip = null;
    cb(null);
  });
};

BlockStore.prototype._startBufferWorker = function() {
  var self = this;
  this.bufferInterval = setInterval(self._flushBuffer.bind(self), 2 * 1000);
};
