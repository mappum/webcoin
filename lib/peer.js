var crypto = require('crypto');
var util = require('util');
var BitcorePeer = require('bitcore-p2p').Peer;
var pkg = require('../package.json');

var Peer = module.exports = function(opts) {
  if(opts instanceof BitcorePeer) {
    opts.__proto__ = Peer.prototype;
    return opts;
  } else if(this instanceof Peer) {
    BitcorePeer.call(this, opts);
  } else {
    return new Peer(opts);
  }

  var self = this;
  this.on('version', function(message) {
    self.startHeight = message.startHeight;
    self.services = message.services;
  });
  this.on('ready', function(message) {
    self.connectTime = Date.now();
  });

  this.remoteAddress = 'tcp://' + this.host + ':' + this.port;
};
util.inherits(Peer, BitcorePeer);

Peer.STATUS = BitcorePeer.STATUS;

Peer.prototype._sendVersion = function() {
  var message = this.messages.Version({ relay: this.relay });

  message.subversion = '/' + pkg.name + ':' + pkg.version + message.subversion;
  if(process.browser) message.subversion += navigator.userAgent + '/';
  else message.subversion += process.title + ':' + process.versions.node + '/';

  this.versionSent = true;
  this.sendMessage(message);
};
