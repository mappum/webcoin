var EventEmitter = require('events').EventEmitter
var path = require('path')
var util = require('util')
var async = require('async')
var bitcore = require('bitcore-lib')
var keyHash = bitcore.crypto.Hash.sha256ripemd160
var BlockHeader = bitcore.BlockHeader
var HDPrivateKey = bitcore.HDPrivateKey
var Transaction = bitcore.Transaction
var Output = Transaction.Output
var Script = bitcore.Script
var Address = bitcore.Address
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
  this.closed = false

  this.rootKey = opts.rootKey || null
  this.pubKey = this.rootKey ? this.rootKey.hdPublicKey : null
  this.state = null
  this.lookAhead = opts.lookAhead || 1

  this.unspent = {}
  this.transactions = opts.transactions || new TransactionStore({
    store: this.store
  })

  this.feePerKb = opts.feePerKb || 10000

  this.filters = []

  this._error = this._error.bind(this)
  this.initialized = false
  this._initialize(cb)
}
util.inherits(Wallet, EventEmitter)

Wallet.prototype.close = function (cb) {
  var self = this
  this.waitForReady(function () {
    self.closed = true
    self.store.close(cb)
  })
}

Wallet.prototype.getKey = function () {
  var key = this.deriveKey(this.state.i++)
  this._generateKeys()
  return key
}

Wallet.prototype.getAddress = function () {
  return this.getKey().publicKey.toAddress(this.network)
}

Wallet.prototype.send = function (recipient, amount, cb) {
  var self = this
  var recipients
  if (typeof amount === 'number') {
    recipients = {}
    recipients[recipient] = amount
  } else if (typeof recipient === 'object') {
    recipients = recipient
    cb = amount
  }

  var total = 0
  for (var address in recipients) total += recipients[address]
  if (total > this.state.balance) return cb(new Error('Insufficient balance'))

  var tx = new Transaction()
  tx.change(this.getAddress())
  for (address in recipients) tx.to(address, recipients[address])

  var inputs = []
  var inputIds = []
  var inputAmount = 0
  while (inputAmount < total + tx.getFee()) {
    var utxo = this.getUTXO(total + tx.getFee(), inputIds)
    inputs.push(utxo)
    inputIds.push(utxo.id)
    inputAmount += utxo.satoshis
    tx.from(utxo)
  }

  async.eachSeries(inputs, function (input, cb) {
    var k = input.address.hashBuffer.toString('base64')
    self.store.get(k, function (err, keyInfo) {
      if (err) return cb(err)
      var key = self.rootKey.derive(keyInfo.path)
      tx.sign(key.privateKey, bitcore.crypto.Signature.SIGHASH_ALL)
      cb(null)
    })
  }, function (err) {
    if (err) return cb(err)
    self.peers.broadcastTransaction(tx)
    cb(null)
  })
}

Wallet.prototype.getUTXO = function (amount, exclude) {
  var closest, closestDiff
  for (var id in this.unspent) {
    var output = this.unspent[id]
    if (exclude && exclude.indexOf(id) !== -1) continue
    var diff = Math.abs(output.satoshis - amount)
    if (!closest || diff < closestDiff) {
      closest = id
      closestDiff = diff
    }
  }
  if (!closest) return null

  var script = new Script(this.unspent[closest].script)
  return {
    id: closest,
    address: new Address(script.getAddressInfo(this.network)),
    txid: new Buffer(closest.split(':')[0], 'base64').toString('hex'),
    outputIndex: +closest.split(':')[1],
    script: script,
    satoshis: this.unspent[closest].satoshis
  }
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
    self.initialized = true
    self.emit('ready')
    if (cb) cb(null)
  })
}

Wallet.prototype.waitForReady = function (cb) {
  if (this.initialized) return cb()
  this.on('ready', cb)
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
      self._saveState(self._scanChain.bind(self))
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
      async.eachSeries(path.remove, self._unprocessBlock.bind(self), function (err) {
        if (err) return self._error(err)
        processTransactions()
      })
      return
    }
    processTransactions()

    function processTransactions () {
      var tipHash = u.toHash(self.state.tip.header.hash)
      var txs = self.node.createTransactionStream({ from: tipHash })
      self.emit('syncing', self.state.tip)

      var initialState = {
        i: self.state.i,
        gen: self.state.gen,
        createdAt: self.state.createdAt,
        balance: self.state.balance
      }
      if (self.state.tip) {
        initialState.tip = {
          height: self.state.tip.height,
          header: self.state.tip.header
        }
      }

      function error (err) {
        if (!err) return
        txs.pause()

        // reset state to last known good state
        self.state = initialState
        self._saveState(function () {
          self._error(err)
        })
      }

      // TODO: pull from stream instead of getting pushed events (so we can verify before continuing)
      //       currently, we could have race conditions where we save the state at the end of the stream,
      //       while we are in the middle of checking an invalid tx
      txs.on('data', function (tx) {
        self.isRelevant(tx.transaction, function (err, relevant) {
          if (err) return error(err)
          if (!relevant) return
          self._processTransaction(tx, function (err) {
            if (err) return error(err)

            self.state.tip = {
              height: tx.block.height,
              header: tx.block.header
            }
            self._saveState(error)
          })
        })
      })
      txs.on('end', function () {
        self.scanning = false
        if (!txs.last) return
        self.state.tip = {
          height: txs.last.height,
          header: txs.last.header
        }
        self._saveState(function (err) {
          if (err) return self._error(err)
          self.emit('synced')
        })
      })
      txs.blocks.on('data', function (block) {
        self.emit('sync', block)
      })
    }
  })
}

Wallet.prototype.isOwnOutput = function (output, cb) {
  if (!output.script) return cb(null, false)
  if (output.script.isPublicKeyHashOut() || output.script.isPublicKeyOut()) {
    var addr = output.script.toAddress(this.network)
    if (!addr) return cb(null, false)
    this.store.get(addr.hashBuffer.toString('base64'), function (err, key) {
      if (err && !err.notFound) return cb(err)
      if (err && err.notFound) return cb(null, false)
      cb(null, true)
    })
    return
  }
  // TODO: support P2SH of pay-to-pubkey and pay-to-pubkey-hash
}

Wallet.prototype.isOwnInput = function (input, cb) {
  if (!input.script) return cb(null, 0)
  if (input.script.isPublicKeyHashIn() || input.script.isPublicKeyIn()) {
    var addr = input.script.toAddress(this.network)
    if (!addr) return cb(null, false)
    this.store.get(addr.hashBuffer.toString('base64'), function (err, key) {
      if (err && !err.notFound) return cb(err)
      if (err && err.notFound) return cb(null, false)
      cb(null, true)
    })
    return
  }
  // TODO: support P2SH of pay-to-pubkey and pay-to-pubkey-hash
}

Wallet.prototype.getOwnOutputs = function (tx, cb) {
  var self = this
  var outputs = []
  async.eachSeries(tx.outputs, function (output, cb) {
    self.isOwnOutput(output, function (err, own) {
      if (err) return cb(err)
      if (own) outputs.push(output)
      cb(null)
    })
  }, function (err) {
    return cb(err, outputs)
  })
}

Wallet.prototype.getOwnInputs = function (tx, cb) {
  var self = this
  var inputs = []
  async.eachSeries(tx.inputs, function (input, cb) {
    self.isOwnInput(input, function (err, own) {
      if (err) return cb(err)
      if (own) inputs.push(input)
      cb(null)
    })
  }, function (err) {
    return cb(err, inputs)
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

Wallet.prototype.total = function (items) {
  var amount = 0
  items.forEach(function (item) { amount += item.satoshis })
  return amount
}

Wallet.prototype.amountReceived = function (tx, cb) {
  var self = this
  this.getOwnOutputs(tx, function (err, outputs) {
    if (err) return cb(err)
    cb(null, self.total(outputs))
  })
}

Wallet.prototype.amountSent = function (tx, cb) {
  var self = this
  this.getOwnInputs(tx, function (err, inputs) {
    if (err) return cb(err)
    cb(null, self.total(inputs))
  })
}

Wallet.prototype._processTransaction = function (tx, cb) {
  var self = this
  // TODO: make store operations atomic
  this.transactions.get(tx.transaction.hash, function (err, storedTx) {
    if (err && !err.notFound) return cb(err)
    if (storedTx) return cb(new Error('Transaction was already processed'))

    var balanceDelta = 0

    async.series([
      function (cb) {
        self._processOutputs(tx, function (err, received) {
          balanceDelta += received
          cb(err)
        })
      },
      function (cb) {
        self._processInputs(tx, function (err, sent) {
          balanceDelta -= sent
          cb(err)
        })
      },
      function (cb) {
        self.transactions.put(tx.transaction, { block: tx.block.header.hash }, function (err, _, meta) {
          if (err) return cb(err)
          if (meta.existed) return cb(new Error('Transaction was already in store'))
          cb(null)
        })
      }
    ],
    function (err) {
      if (err) return cb(err)
      self.state.balance += balanceDelta
      self._saveState(cb)
    })
  })
}

Wallet.prototype._processOutputs = function (tx, cb) {
  var self = this
  this.getOwnOutputs(tx.transaction, function (err, outputs) {
    if (err) return cb(err)
    if (outputs.length === 0) return cb(null, 0)
    var addresses = outputs.map(function (output) {
      return output.script.getAddressInfo(self.network)
    })
    var amount = self.total(outputs)

    self._addUnspent(tx.transaction, function (err) {
      if (err) return cb(err)
      // TODO: disregard change in amount
      self.emit('receive', {
        transaction: tx.transaction,
        block: tx.block,
        addresses: addresses,
        amount: amount
      })
      cb(null, amount)
    })
  })
}

Wallet.prototype._processInputs = function (tx, cb) {
  var self = this
  this.getOwnInputs(tx.transaction, function (err, inputs) {
    if (err) return cb(err)
    if (inputs.length === 0) return cb(null, 0)
    var addresses = inputs.map(function (input) {
      return input.script.getAddressInfo(self.network)
    })
    var amount = 0
    async.each(inputs, function (input, cb) {
      self.transactions.get(input.prevTxId, function (err, tx) {
        if (err) return cb(err)
        var output = tx.transaction.outputs[input.outputIndex]
        amount += output.satoshis
        cb(null)
      })
    }, function (err) {
      if (err) return cb(err)
      self._removeUnspent(tx.transaction, function (err) {
        if (err) return cb(err)
        // TODO: disregard change in amount
        self.emit('send', {
          transaction: tx.transaction,
          block: tx.block,
          addresses: addresses,
          amount: amount
        })
        cb(null, amount)
      })
    })
  })
}

Wallet.prototype._unprocessTransaction = function (tx, cb) {
  var self = this
  // TODO: make store operations atomic
  this.transactions.get(tx.transaction.hash, function (err, storedTx) {
    if (err && !err.notFound) return cb(err)
    if (!storedTx) return cb(new Error('Transaction was not found in store'))

    var balanceDelta = 0

    async.series([
      function (cb) {
        self._unprocessOutputs(tx, function (err, received) {
          balanceDelta -= received
          cb(err)
        })
      },
      function (cb) {
        self._unprocessInputs(tx, function (err, sent) {
          balanceDelta += sent
          cb(err)
        })
      },
      function (cb) {
        var hash = new Buffer(tx.transaction.hash, 'hex').toString('base64')
        self.transactions.del(hash, { block: tx.block.header.hash }, function (err, _, meta) {
          if (err) return cb(err)
          if (!meta.existed) return cb(new Error('Transaction was not found in store'))
          cb(null)
        })
      }
    ],
    function (err) {
      if (err) return cb(err)
      self.state.balance += balanceDelta
      self._saveState(cb)
    })
  })
}

Wallet.prototype._unprocessOutputs = function (tx, cb) {
  var self = this
  this.getOwnOutputs(tx.transaction, function (err, outputs) {
    if (err) return cb(err)
    if (outputs.length === 0) return cb(null, 0)
    var addresses = outputs.map(function (output) {
      return output.script.getAddressInfo(self.network)
    })
    var amount = self.total(outputs)

    self._removeUnspent(tx.transaction, function (err) {
      if (err) return cb(err)
      // TODO: disregard change in amount
      self.emit('unreceive', {
        transaction: tx.transaction,
        block: tx.block,
        addresses: addresses,
        amount: amount
      })
      cb(null, amount)
    })
  })
}

Wallet.prototype._unprocessInputs = function (tx, cb) {
  var self = this
  this.getOwnInputs(tx.transaction, function (err, inputs) {
    if (err) return cb(err)
    if (inputs.length === 0) return cb(null, 0)
    var addresses = inputs.map(function (input) {
      return input.script.getAddressInfo(self.network)
    })
    var amount = 0
    async.each(inputs, function (input, cb) {
      self.transactions.get(input.prevTxId, function (err, tx) {
        if (err) return cb(err)
        var output = tx.transaction.outputs[input.outputIndex]
        amount += output.satoshis
        cb(null)
      })
    }, function (err) {
      if (err) return cb(err)
      self.addUnspent(tx.transaction, function (err) {
        if (err) return cb(err)
        // TODO: disregard change in amount
        self.emit('unsend', {
          transaction: tx.transaction,
          block: tx.block,
          addresses: addresses,
          amount: amount
        })
        cb(null, amount)
      })
    })
  })
}

Wallet.prototype._unprocessBlock = function (blockHash, cb) {
  var self = this
  this.transactions.get(blockHash, function (err, index) {
    if (err && !err.notFound) return cb(err)
    if ((err && err.notFound) || index.length === 0) return cb(null)
    self.chain.get(blockHash, function (err, block) {
      if (err) return cb(err)
      async.eachSeries(index, function (txid, cb) {
        self.transactions.get(txid, function (err, tx) {
          if (err) return cb(err)
          self._unprocessTransaction({ transaction: tx, block: block }, cb)
        })
      }, cb)
    })
  })
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
      var serialized = self.rootKey.xprivkey
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
        self.emit('genkey', key, i)
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

Wallet.prototype.derivePrivateKey = function (i) {
  return this.rootKey.derive(0).derive(i)
}

Wallet.prototype._loadUnspent = function (cb) {
  var self = this
  if (!cb) cb = this._error

  this.store.get('unspent', function (err, unspent) {
    if (err && err.name !== 'NotFoundError') return cb(err)
    if (unspent) {
      for (var id in unspent) unspent[id] = new Output(unspent[id])
      self.unspent = unspent
    }
    return cb(null, self.unspent)
  })
}

Wallet.prototype._saveUnspent = function (cb) {
  if (!cb) cb = this._error
  this.store.put('unspent', this.unspent, cb)
}

Wallet.prototype._addUnspent = function (tx, cb) {
  var self = this
  var txid = new Buffer(tx.hash, 'hex').toString('base64')
  this.getOwnOutputs(tx, function (err, outputs) {
    if (err) return cb(err)
    if (outputs.length === 0) return cb(null)
    outputs.forEach(function (output) {
      var i = tx.outputs.indexOf(output)
      var id = txid + ':' + i
      self.unspent[id] = output.toObject()
    })
    self._saveUnspent(cb)
  })
}

Wallet.prototype._removeUnspent = function (tx, cb) {
  var self = this
  this.getOwnInputs(tx, function (err, inputs) {
    if (err) return cb(err)
    if (inputs.length === 0) return cb(null)
    inputs.forEach(function (input) {
      var id = input.prevTxId.toString('base64') + ':' + input.outputIndex
      if (!self.unspent[id]) {
        var err = new Error('Output ' + id + ' was not in UTXO set')
        err.outputId = id
        return cb(err)
      }
      delete self.unspent[id]
    })
    self._saveUnspent(cb)
  })
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
        createdAt: Math.floor(Date.now() / 1000),
        balance: 0
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
    createdAt: this.state.createdAt,
    balance: this.state.balance
  }
  if (this.state.tip) {
    state.tip = {
      height: this.state.tip.height,
      header: this.state.tip.header.toBuffer().toString('base64')
    }
  }
  this.store.put('state', state, cb)
}

Wallet.prototype.addFilter = function (filter) {
  var self = this
  if (this.filters.indexOf(filter) !== -1) return
  this.filters.push(filter)
  function addKey (hdkey) {
    var pubkey = hdkey.publicKey
    filter.insert(pubkey.toBuffer())
    filter.insert(keyHash(pubkey.toBuffer()))
  }
  function addExistingKeys () {
    for (var i = 0; i < self.state.gen; i++) {
      addKey(self.deriveKey(i))
    }
  }
  if (this.state) {
    addExistingKeys()
  } else {
    this.on('ready', addExistingKeys)
  }
  this.on('genkey', addKey)
}
