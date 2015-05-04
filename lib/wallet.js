var EventEmitter = require('events').EventEmitter
var path = require('path')
var util = require('util')
var async = require('async')
var bitcore = require('bitcore')
var keyHash = bitcore.crypto.Hash.sha256ripemd160
var BlockHeader = bitcore.BlockHeader
var HDPrivateKey = bitcore.HDPrivateKey
var TransactionStore = require('./transactionStore.js')
var u = require('./utils.js')

var TIME_MARGIN = 3 * 60 * 60

var Wallet = module.exports = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  if (!opts.path) throw new Error('"path" option is required for Wallet')
  if (!opts.id) throw new Error('"id" option is required for Wallet')
  if (!opts.node) throw new Error('"node" option is required for Wallet')

  this.node = opts.node
  this.chain = this.node.chain
  this.peers = this.node.peers
  this.network = this.node.network

  this.id = opts.id
  this.path = path.normalize(opts.path + '/' + this.id + '.' + this.network.name + '.wallet')
  this.store = opts.store || u.createStore({ path: this.path, db: opts.db })

  this.scanning = false

  this.rootKey = opts.rootKey || null
  this.pubKey = this.rootKey ? this.rootKey.hdPublicKey : null
  this.state = null
  this.lookAhead = opts.lookAhead || 1

  this.unspent = {}
  this.transactions = opts.transactions || new TransactionStore({
    path: path.normalize(opts.path + '/' + this.id + '.' + this.network.name + '.txs')
  })

  this._error = this._error.bind(this)
  this._initialize(cb)
}
util.inherits(Wallet, EventEmitter)

Wallet.prototype.getKey = function () {
  var key = this.deriveKey(this.state.i++)
  this._generateKeys()
  return key
}

Wallet.prototype.getAddress = function () {
  return this.getKey().publicKey.toAddress(this.network)
}

Wallet.prototype._error = function (err) {
  if (!err) return
  this.emit('error', err)
}

Wallet.prototype._initialize = function (cb) {
  var self = this

  async.series([
    function (cb) {
      async.parallel([
        self._loadRootKey.bind(self),
        self._loadUnspent.bind(self),
        self._loadState.bind(self)
      ], cb)
    },
    this._initializeKeys.bind(this)
  ], function (err, res) {
    if (err) return (cb || self._error)(err)
    self._listenToChain()
    self.emit('ready')
    if (cb) cb(null)
  })
}

Wallet.prototype._listenToChain = function () {
  var self = this
  if (this.peers.numberConnected() === 0) {
    this.peers.once('peer', function () { self._listenToChain() })
    return
  }
  this.chain.on('block', this._update.bind(this))
  this._update()
}

Wallet.prototype._update = function () {
  var self = this
  var scanStart = this.state.createdAt - TIME_MARGIN
  if (this.chain.tip.header.time < scanStart) return
  if (!this.state.tip) {
    this.chain.getBlockAtTime(this.state.createdAt - TIME_MARGIN, function (err, block) {
      if (err) return self._error(err)
      self.state.tip = block
      self._saveState()
      self._scanChain()
    })
    return
  }
  this._scanChain()
}

Wallet.prototype._scanChain = function (opts) {
  var self = this
  opts = opts || {}

  if (this.scanning) return
  this.scanning = true

  this.node.chain.getPathToTip(this.state.tip, function (err, path) {
    if (err) return self._error(err)

    if (path.remove.length > 0) {
      // TODO: rewind transactions in reorg
    }

    var tipHash = u.toHash(self.state.tip.header.hash)
    var txs = self.node.createTransactionStream({ from: tipHash })
    self.emit('syncing', self.state.tip)
    function error (err) {
      if (!err) return
      txs.pause()
      self._error(err)
    }
    txs.on('data', function (tx) {
      self.isRelevant(tx.transaction, function (err, relevant) {
        if (err) return error(err)
        if (!relevant) return
        self._processTransaction(tx, error)
      })
    })
    txs.on('end', function () {
      self.scanning = false
      self.state.tip = {
        height: txs.last.height,
        header: txs.last.header
      }
      self._saveState(function (err) {
        if (err) return self._error(err)
        self.emit('synced')
      })
    })
  })
}

Wallet.prototype.isRelevant = function (tx, cb) {
  var self = this
  this.amountReceived(tx, function (err, received) {
    if (err) return cb(err)
    if (received !== 0) return cb(null, true)
    self.amountSent(tx, function (err, sent) {
      if (err) return cb(err)
      return cb(null, sent !== 0)
    })
  })
}

Wallet.prototype.amountReceived = function (tx, cb) {
  var self = this
  async.reduce(tx.outputs, 0, function (amount, output, cb) {
    if (output.script.isPublicKeyHashOut() || output.script.isPublicKeyOut()) {
      var pubHash = output.script.toAddress(self.network).hashBuffer
      self.store.get(pubHash.toString('base64'), function (err, key) {
        if (err && !err.notFound) return cb(err)
        if (err && err.notFound) return cb(null, amount)
        cb(null, amount + output.satoshis)
      })
      return
    }
    // TODO: support P2SH of pay-to-pubkey and pay-to-pubkey-hash
    cb(null, amount)
  }, cb)
}

Wallet.prototype.amountSent = function (tx, cb) {
  var self = this
  async.reduce(tx.inputs, 0, function (amount, input, cb) {
    if (!input.script) return cb(null, 0)
    if (input.script.isPublicKeyHashIn() || input.script.isPublicKeyIn()) {
      var pubHash = input.script.toAddress(self.network).hashBuffer
      self.store.get(pubHash.toString('base64'), function (err, key) {
        if (err && !err.notFound) return cb(err)
        if (err && err.notFound) return cb(null, amount)
        cb(null, amount + input.satoshis)
      })
      return
    }
    // TODO: support P2SH of pay-to-pubkey and pay-to-pubkey-hash
    cb(null, amount)
  }, cb)
}

Wallet.prototype._processTransaction = function (tx, cb) {
  console.log('saving tx:', tx.transaction.hash)
  this.transactions.put(tx.transaction, { block: tx.block.header.hash }, cb)
  // TODO: adjust unspent, balance
}

Wallet.prototype._loadRootKey = function (cb) {
  var self = this
  if (!cb) cb = function () {}
  if (this.rootKey) return cb(null, this.rootKey)

  var opts = { valueEncoding: 'utf8' }
  this.store.get('root', opts, function (err, root) {
    if (err && !err.notFound) return cb(err)
    if (err && err.notFound) {
      self.rootKey = new HDPrivateKey()
      var serialized = self.rootKey.toBuffer()
      self.store.put('root', serialized, opts, function (err) { cb(err, self.rootKey) })
      return
    }
    self.rootKey = new HDPrivateKey(root)
    return cb(null, self.rootKey)
  })
}

Wallet.prototype._initializeKeys = function (cb) {
  this.pubKey = this.rootKey.hdPublicKey
  this._generateKeys(cb)
}

Wallet.prototype._generateKeys = function (cb) {
  var self = this
  var tasks = []
  for (var i = this.state.gen; i < this.state.i + this.lookAhead; i++) {
    (function (i) {
      tasks.push(function (cb) {
        var key = self.deriveKey(i)
        var hash = keyHash(key.publicKey.toBuffer())
        var value = {
          used: false,
          path: 'm/0/' + i
        }
        self.store.put(hash.toString('base64'), value, cb)
      })
    })(i)
  }
  async.series(tasks, function (err) {
    if (err) return cb(err)
    self.state.gen = i
    self._saveState(cb)
  })
}

Wallet.prototype.deriveKey = function (i) {
  return this.pubKey.derive(0).derive(i)
}

Wallet.prototype._loadUnspent = function (cb) {
  var self = this
  if (!cb) cb = this._error

  this.store.get('unspent', function (err, unspent) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    if (unspent) self.unspent = unspent
    return cb(null, self.unspent)
  })
}

Wallet.prototype._saveUnspent = function (cb) {
  if (!cb) cb = this._error
  this.store.put('unspent', this.unspent, cb)
}

Wallet.prototype._loadState = function (cb) {
  var self = this
  if (!cb) cb = this._error

  this.store.get('state', function (err, state) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    if (!state) {
      self.state = {
        i: 0,
        gen: 0,
        tip: null,
        createdAt: Math.floor(Date.now() / 1000)
      }
      self._saveState(function (err) {
        if (err) return cb(err)
        cb(null, self.state)
      })
      return
    }

    if (state.tip) {
      var header = new Buffer(state.tip.header, 'base64')
      state.tip.header = BlockHeader.fromBuffer(header)
    }
    self.state = state
    cb(null, self.state)
  })
}

Wallet.prototype._saveState = function (cb) {
  var self = this
  if (!cb) cb = function (err) { if (err) self._error(err) }
  var state = {
    i: this.state.i,
    gen: this.state.gen,
    tip: null,
    createdAt: this.state.createdAt
  }
  if (this.state.tip) {
    state.tip = {
      height: this.state.tip.height,
      header: this.state.tip.header.toBuffer().toString('base64')
    }
  }
  this.store.put('state', state, cb)
}
