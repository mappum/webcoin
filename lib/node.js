var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var bitcore = require('bitcore')
var Blockchain = require('./blockchain.js')
var PeerGroup = require('./peerGroup.js')
var BlockStream = require('../lib/blockStream.js')
var TransactionStream = require('../lib/transactionStream.js')
var Wallet = require('../lib/wallet.js')
var constants = require('../lib/constants.js')

var Node = module.exports = function (opts, cb) {
  var self = this
  opts = opts || {}

  this.path = opts.path || 'data'
  this.path.replace(/[/\\]$/, '')

  this.network = opts.network || bitcore.Networks.livenet

  this.peers = opts.peers || new PeerGroup({
    network: this.network,
    acceptWeb: opts.accept || opts.acceptWeb,
    acceptTcp: opts.accept || opts.acceptTcp,
    getTip: function () { return self.chain.getTip() }
  })
  this.peers.on('error', this._error.bind(this))

  this.chain = opts.chain || new Blockchain({
    network: this.network,
    peerGroup: this.peers,
    path: this.path + '/' + (opts.chainPath || this.network.name + '.chain'),
    store: opts.chainStore,
    to: opts.to,
    checkpoint: constants.checkpoints[this.network.name]
  })
  this.chain.on('error', this._error.bind(this))

  this.wallets = {}

  this.closing = false
  this.closed = false

  if (cb) this.start(cb)
}
util.inherits(Node, EventEmitter)

Node.prototype.start = function (cb) {
  var self = this
  cb = cb || function () {}

  this.peers.on('peerconnect', this._onPeerConnect.bind(this))

  async.parallel([
    this.peers.connect.bind(this.peers),
    function (cb) {
      self.chain.once('syncing', function () { cb(null) })
      self.chain.sync()
    }
  ], cb)

  this.emit('ready')
}

Node.prototype.close = function (cb) {
  if (!cb) cb = function () {}
  var self = this

  this.closing = true

  var tasks = [ this.peers.disconnect.bind(this.peers) ]

  tasks.push(function (cb) {
    var wallets = []
    for (var id in this.wallets) wallets.push(this.wallets[id])
    async.each(wallets, function (wallet, cb) { wallet.close(cb) }, function (err) {
      if (err) return cb(err)
      self.chain.close(function (err) {
        if (err) return cb(err)
        this.closed = true
        cb(null)
      })
    })
  })

  async.parallel(tasks, function (err) {
    if (err) return (self._error || cb)(err)
    self.emit('end')
    cb(null)
  })
}

Node.prototype.createBlockStream = function (opts) {
  var peer = this.peers.randomPeer()
  if (!peer) throw new Error('Not connected to any peers')
  opts.peer = peer
  opts.chain = this.chain
  return new BlockStream(opts)
}

Node.prototype.createTransactionStream = function (opts) {
  var blocks = this.createBlockStream(opts)
  return new TransactionStream(blocks)
}

Node.prototype.createWallet = function (id, opts, cb) {
  if (!id) throw new Error('Wallet id is required')
  if (this.wallets[id]) throw new Error('A Wallet already exists with id "' + id + '"')
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  opts.id = id
  opts.path = this.path
  opts.node = this
  var wallet = new Wallet(opts, cb)
  this.wallets[id] = wallet
  return wallet
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
    if (err !== true && !(err.message === 'Database is not open' && self.closing)) {
      return self._error(err)
    }
    if (!start || !start.next) return
    self.chain.store.get(start.next, next)
  })
}
