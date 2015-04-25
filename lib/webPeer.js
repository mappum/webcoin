var crypto = require('crypto')
var util = require('util')
var Peer = require('./peer.js')

var WebPeer = module.exports = function (conn, opts) {
  var self = this
  for (var k in opts) this[k] = opts[k]
  Peer.call(this, { socket: conn })
  delete this.port

  this.bestHeight = 0
  this.remoteAddress = 'WebRTC://?' // TODO: get address during signalling

  this.on('version', function (message) {
    self.bestHeight = message.startHeight
  })

  this._startKeepAlive()
}
util.inherits(WebPeer, Peer)

WebPeer.prototype.connect = function () {
  this.status = Peer.STATUS.CONNECTED
  this.emit('connect')
  this._sendVersion()
  return this
}

WebPeer.prototype._startKeepAlive = function () {
  var self = this
  this.heartbeat = setInterval(function () {
    var ping = self.messages.Ping(crypto.pseudoRandomBytes(8))
    self.sendMessage(ping)
  }, 10 * 1000)

  this.once('disconnect', function () {
    clearInterval(self.heartbeat)
  })
}
