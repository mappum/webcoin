var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var bitcore = require('bitcore');
var genesis = require('./constants.js').genesisHeaders;
var BlockStore = require('./blockStore.js');
var u = require('./utils.js');

var Blockchain = module.exports = function(opts) {
  opts = opts || {};
  if(!opts.peerGroup) throw new Error('"peerGroup" option is required for Blockchain');
  this.peerGroup = opts.peerGroup;
  this.network = bitcore.Networks.get(opts.network) || bitcore.Networks.defaultNetwork;
  this.store = opts.store || new BlockStore({ path: opts.path });

  var genesisHeader = genesis[this.network.name];
  this.tip = {
    height: 0,
    hash: u.toHash(genesisHeader.hash),
    header: genesisHeader
  };
  this.downloadPeer = null;
  this.syncing = false;
  this.initialized = false;

  this._onHeaders = this._onHeaders.bind(this);
  this._onDownloadPeerDisconnect = this._onDownloadPeerDisconnect.bind(this);
};
util.inherits(Blockchain, EventEmitter);

Blockchain.prototype.sync = function(opts, cb) {
  var self = this;
  if(this.syncing) return cb(null);
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(cb) this.once('synced', cb);

  this.syncing = true;
  this.on('block', function syncDone(block) {
    if(block.height >= self.downloadPeer.startHeight) {
      self.removeListener('block', syncDone);
      self.syncing = false;
      self.emit('synced', block);
    }
  });

  var startDownload = function(err) {
    if(err) {
      err = new Error('Error initializing blockchain: '+err);
      if(cb) return cb(err);
      else self.emit('error', err);
    }
    if(!self.downloadPeer) self._findDownloadPeer(self._getHeaders.bind(self));
    else self._getHeaders();
  };
  if(!this.initialized) this._initialize(startDownload);
  else startDownload(null);
};

Blockchain.prototype._initialize = function(cb) {
  if(this.initialized) return cb(null);

  var self = this;
  this.store.getTip(function(err, tip) {
    self.initialized = true;
    if(err && err.name === 'NotFoundError') return cb(null);
    if(err) return cb(err);
    self.tip = tip;
    cb(null, tip);
  });
};

Blockchain.prototype._findDownloadPeer = function(cb) {
  var self = this;

  if(this.peerGroup.peers.length === 0) {
    this.peerGroup.once('peerconnect', function() {
      self._findDownloadPeer(cb);
    });
    return;
  }

  var peer = this.peerGroup.peers[Math.floor(Math.random() * this.peerGroup.peers.length)];
  this._setDownloadPeer(peer);
  return cb(null, peer);
};

Blockchain.prototype._setDownloadPeer = function(peer) {
  if(this.downloadPeer) {
    this.downloadPeer.removeListener('headers', this._onHeaders);
    this.downloadPeer.removeListener('disconnect', this._onDownloadPeerDisconnect);
  }

  this.downloadPeer = peer;
  peer.on('headers', this._onHeaders);
  peer.on('disconnect', this._onDownloadPeerDisconnect);
};

Blockchain.prototype._getHeaders = function(opts) {
  var self = this;
  if(!this.downloadPeer) throw new Error('No download peer set');
  opts = opts || {};
  this._getLocator(opts.from || this.tip.hash, function(err, locator) {
    if(err) throw err;
    var message = self.downloadPeer.messages.GetHeaders({
      starts: locator
    });
    self.downloadPeer.sendMessage(message);
  });
};

Blockchain.prototype._onHeaders = function(message) {
  var self = this;
  if(!message.headers) return console.error('No headers in "headers" message from download peer');
  this._processHeaders(message.headers, function(err, last) {
    if(err) return console.error('Peer sent invalid headers:', err, last);
    self.emit('sync', self.tip);
    if(self.syncing) self._getHeaders();
  });
};

Blockchain.prototype._onDownloadPeerDisconnect = function() {
  console.log('Download peer disconnected');
  self.downloadPeer = null;
};

Blockchain.prototype._getLocator = function(from, cb) {
  // TODO: support specifying locator by timestamp and by height
  // TODO: include some previous blocks in case our tip is on a fork
  return cb(null, [ from ]);
};

Blockchain.prototype._get = function(hash, cb) {
  if(hash.compare(this.tip.hash) === 0) return cb(null, this.tip);

  this.store.get(hash, function(err, block) {
    if(err) return cb(err);
    cb(null, block);
  });
};

Blockchain.prototype._processHeaders = function(headers, cb) {
  var self = this;
  var fromTip = headers[0].prevHash.compare(self.tip.hash) === 0;
  this._get(headers[0].prevHash, function(err, prev) {
    if(err && err.name === 'NotFoundError') return cb(new Error('Block does not connect to chain')); 
    if(err) return cb(err);
    async.reduce(headers, prev, self._processHeader.bind(self), function(err, res) {
      if(err) return cb(err, last);
      if(!fromTip && res.height - prev.height > 1) self.emit('reorg', res);
      cb(null, res);
    });
  });
};

Blockchain.prototype._processHeader = function(prev, header, cb) {
  if(prev instanceof bitcore.BlockHeader) {
    header = prev;
    prev = this.tip;
  }

  var self = this;
  var height = prev.height + 1;
  var output = {
    height: height,
    hash: u.toHash(header.hash),
    header: header
  };

  if(header.prevHash.compare(prev.hash) !== 0) {
    return cb(new Error('Block does not connect to previous'), output);
  }
  if(!self._difficultyChange(height) && header.bits !== prev.header.bits) {
    return cb(new Error('Unexpected difficulty change'), output);
  }
  if(!header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'), output);
  }
  // TODO: other checks (timestamp, version)

  var tip = height > self.tip.height;
  self.store.put({ header: header, height: height }, { tip: tip }, function(err) {
    if(err) return cb(err);

    if(tip) {
      self.tip.height = height;
      self.tip.hash = output.hash;
      self.tip.header = header;
      output.syncing = self.syncing;      
      self.emit('block', output);
    }

    cb(null, output);
  });
};

Blockchain.prototype._difficultyChange = function(height) {
  return !(height % 2016);
};
