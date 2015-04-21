var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Networks = require('bitcore').Networks;
var Peerhub = require('peerhub');

if(!process.browser) {
  var p2p = require('bitcore-p2p');
}

var webSeeds = [
  'localhost:8192'
];

var PeerGroup = module.exports = function(opts) {
  var self = this;
  opts = opts || {};
  this.network = Networks.get(opts.network) || Networks.defaultNetwork;
  this.acceptTcp = opts.acceptTcp || false;
  this.acceptWeb = opts.acceptWeb || false;
  this.maxSize = opts.maxSize || 8;
  this.verbose = opts.verbose || false;

  this.webSeedClients = [];

  this.peers = [];
  this.on('peerconnect', function(peer) {
    self.peers.push(peer);
    peer.on('disconnect', function() {
      var index = self.peers.indexOf(peer);
      self.peers.splice(index, 1);
    });
  });
};
util.inherits(PeerGroup, EventEmitter);

PeerGroup.prototype.numberConnected = function() {
  return this.peers.length;
};

PeerGroup.prototype.connect = function(opts) {
  var self = this;
  opts = opts || {};

  if(!process.browser) {
    // first check if a peer is running on the local machine
    this._connectToLocalhost(function(err, peer) {
      if(err) {
        // if we couldn't connect to the local peer, connect to DNS seed peers
        if(self.verbose) console.log('Could not connect to local peer:', err);
        return self._connectToDNSPeers(function(err, peer, pool) {
          if(err) return console.error(err);
          if(!self.pool) self.pool = pool;
          self.emit('peerconnect', peer);
        });
      }

      self.emit('peerconnect', peer);
    });
  }

  webSeeds.forEach(function(uri) {
    var client = new Peerhub.Client(uri, function() {
      if(self.verbose) console.log('Connected to web seed:', uri);
      self.webSeedClients.push(client);

      self._connectToWebPeers(self._onWebPeerConnect.bind(self));

      if(self.acceptWeb) {
        client.accept(function(id, peer) { self._onWebPeerConnect(peer); });
      }
    });
  });
};

PeerGroup.prototype._connectToLocalhost = function(cb) {
  if(process.browser) return cb(new Error('Not supported in the browser'));

  var localPeer = new p2p.Peer({ host: 'localhost' });

  var couldNotConnect = function() {
    if(cb) return cb(new Error('Could not connect'));
  };

  localPeer.on('error', couldNotConnect);
  localPeer.on('ready', function() {
    localPeer.removeListener('error', couldNotConnect);
    if(cb) return cb(null, localPeer);
  });

  localPeer.connect();
};

PeerGroup.prototype._connectToDNSPeers = function(opts, cb) {
  if(process.browser) return cb(new Error('Not supported in the browser'));

  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  if(opts.maxSize == null) opts.maxSize = Math.floor(this.maxSize / 2);

  var pool = new p2p.Pool(opts);
  var callbackCount = 0;
  var onConnect = function(peer) {
    peer.on('ready', function() {
      callbackCount++;
      if(callbackCount >= opts.maxSize) pool.removeListener('peerconnect', onConnect);
      cb(null, peer, pool);
    });
  };
  pool.on('peerconnect', onConnect);
  pool.connect();

  if(this.acceptTcp) pool.listen();
};

PeerGroup.prototype._connectToWebPeers = function(opts, cb) {
  var self = this;
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  var client = this.webSeedClients[Math.floor(Math.random() * this.webSeedClients.length)];
  client.discover(function(err, peerIds) {
    if(err) return console.error(err);

    peerIds = peerIds.slice(0, self.maxSize - self.numberConnected());
    peerIds.forEach(function(id) { client.connect(id, cb); });
  });
};

PeerGroup.prototype._onWebPeerConnect = function(peer) {
  if(this.verbose) console.log('Connected to a web peer');
  // TODO: wrap peer with webcoin Peer class
  //this.emit('peerconnect', peer);
};
