var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var Networks = require('bitcore').Networks;
var genesis = require('./constants.js').genesisHeaders;
var BlockStore = require('./blockStore.js');
var u = require('./utils.js');

var Blockchain = module.exports = function(opts) {
  opts = opts || {};
  if(!opts.peerGroup) throw new Error('"peerGroup" option is required for Blockchain');
  this.peerGroup = opts.peerGroup;
  this.network = Networks.get(opts.network) || Networks.defaultNetwork;
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
  if(this.syncing) return cb(null);
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(cb) this.once('synced', cb);
  this.syncing = true;

  var self = this;
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
    if(err && err.name === 'NotFoundError') return cb(null);
    if(err) return cb(err);
    self.tip = tip;
    console.log('tip', tip)
    self.initialized = true;
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
  this._processHeaders(message.headers, function(err) {
    if(err) return console.error('Peer sent invalid headers:', err);
    self.emit('sync', self.tip);
    self._getHeaders();
  });
};

Blockchain.prototype._onDownloadPeerDisconnect = function() {
  console.log('Download peer disconnected');
  self.downloadPeer = null;
};

Blockchain.prototype._getLocator = function(tip, cb) {
  // TODO: support specifying locator by timestamp and by height
  // TODO: include some previous blocks in case our tip is on a fork
  return cb(null, [ tip ]);
};

Blockchain.prototype._processHeaders = function(headers, cb) {
  var self = this;
  var tasks = headers.map(function(header) {
    return function(cb) {
      self._processHeader(header, cb);
    };
  });
  async.series(tasks, cb);
};

Blockchain.prototype._processHeader = function(header, cb) {
  var self = this;
  var height = this.tip.height + 1;

  if(header.prevHash.compare(this.tip.hash) !== 0) {
    return cb(new Error('Block does not connect'));
  }
  if(!this._difficultyChange(height) && header.bits !== this.tip.header.bits) {
    return cb(new Error('Unexpected difficulty change'));
  }
  if(!header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'));
  }
  // TODO: other checks (timestamp, version)

  this.store.putHeader(header, { tip: true, height: height }, function(err) {
    if(err) return cb(err);

    self.tip.height = height;
    self.tip.hash = u.toHash(header.hash);
    self.tip.header = header;
    cb(null);
  });
};

Blockchain.prototype._difficultyChange = function(height) {
  return !(height % 2016);
};
