var crypto = require('crypto');
var util = require('util');
var Peer = require('bitcore-p2p').Peer;

var WebPeer = module.exports = function(conn) {
  Peer.call(this, { socket: conn });
  delete this.port;

  this._startHeartbeat();
};
util.inherits(WebPeer, Peer);

WebPeer.prototype.connect = function() {
  this.status = Peer.STATUS.CONNECTED;
  this.emit('connect');
  this._sendVersion();
  return this;
};

WebPeer.prototype._startHeartbeat = function() {
  var self = this;
  this.heartbeat = setInterval(function() {
    var ping = self.messages.Ping(crypto.pseudoRandomBytes(8));
    self.sendMessage(ping);
  }, 10 * 1000);

  this.once('disconnect', function() {
    clearInterval(self.heartbeat);
  });
};
