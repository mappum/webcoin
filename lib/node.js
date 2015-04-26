var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var bitcore = require('bitcore')
var Blockchain = require('./blockchain.js')
var PeerGroup = require('./peerGroup.js')

var Node = module.exports = function (opts) {
  var self = this
  opts = opts || {}

  this.path = opts.path || 'data'
  this.path.replace(/[/\\]$/, '')

  this.network = opts.network || bitcore.Networks.livenet

  this.peers = opts.peers || new PeerGroup({
    acceptWeb: opts.accept || opts.acceptWeb,
    acceptTcp: opts.accept || opts.acceptTcp,
    getTip: function () { return self.chain.getTip() }
  })
  this.peers.on('error', this._error.bind(this))

  this.chain = opts.chain || new Blockchain({
    peerGroup: this.peers,
    path: this.path + '/' + (opts.storePath || this.network.name + '.chain'),
    store: opts.store
  })
  this.chain.on('error', this._error.bind(this))
}
util.inherits(Node, EventEmitter)

Node.prototype.start = function () {
  this.peers.connect()
  this.chain.sync()

  this.peers.on('peerconnect', this._onPeerConnect.bind(this))

  this.emit('initialized')
}

Node.prototype._error = function (err) {
  this.emit('error', err)
}

Node.prototype._onPeerConnect = function (peer) {
  var self = this
  peer.on('getheaders', function (message) {
    self._sendHeaders(peer, message)
  })
}

Node.prototype._sendHeaders = function (peer, message) {
  var self = this
  var start = null
  var headers = []

  function next (err, block) {
    if (err) return self._error(err)
    headers.push(block.header)
    if (headers.length === 2000 || !block.next) {
      peer.sendMessage(peer.messages.Headers(headers))
      return
    }
    self.chain.store.get(block.next, next)
  }

  async.each(message.starts, function (hash, cb) {
    self.chain.store.get(hash, function (err, block) {
      if (err && err.name === 'NotFoundError') return cb(null)
      if (err) return cb(err)
      if (block) {
        start = block
        return cb(true)
      }
    })
  }, function (err) {
    if (err !== true) return self._error(err)
    if (!start || !start.next) return
    self.chain.store.get(start.next, next)
  })
}
