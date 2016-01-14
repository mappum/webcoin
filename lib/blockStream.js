var Readable = require('stream').Readable
var util = require('util')
var Inventory = require('bitcore-p2p').Inventory
var u = require('./utils.js')
var MerkleTree = require('./merkleTree.js')
var Peer = require('./peer.js')

var BlockStream = module.exports = function (opts) {
  if (!opts.peers) throw new Error('"peers" option is required for BlockStream')
  if (!opts.chain) throw new Error('"chain" option is required for BlockStream')
  Readable.call(this, { objectMode: true })

  opts = opts || {}
  this.peers = opts.peers
  this.chain = opts.chain
  this.network = this.chain.network
  this.from = opts.from || 0
  this.to = opts.to || null
  this.filtered = typeof opts.filtered === 'boolean' ? opts.filtered : !!this.peers.filter
  this.fetchTransactions = typeof opts.fetchTransactions === 'boolean' ? opts.fetchTransactions : true
  this.bufferSize = opts.bufferSize || 128

  this.requestCursor = this.from
  this.requestQueue = []
  this.requestHeight = null
  this.buffer = []
  this.pause = false

  if (!this.filtered) {
    this.peers.on('block', this._onBlock.bind(this))
  } else {
    this.peers.on('merkleblock', this._onMerkleBlock.bind(this))
  }
}
util.inherits(BlockStream, Readable)

BlockStream.prototype._error = function (err) {
  this.emit('error', err)
}

BlockStream.prototype._read = function () {
  this.pause = false
  this._next()
}

// FIXME: maybe this should happen outside of BlockStream?
BlockStream.prototype._next = function () {
  var self = this
  if (!this.requestCursor) return
  this.chain.getBlock(this.requestCursor, function (err, block) {
    if (err) return self._error(err)
    if (!self._from) self._from = block
    var hash = u.toHash(block.header.hash)
    if (block.height > self._from.height) {
      if (self.requestHeight == null) {
        self.requestHeight = block.height
      }
      self.requestQueue.push(hash)
      self._getData(block)
    }
    if (!block.next) {
      return self.requestQueue.push(null)
    }
    self.requestCursor = u.toHash(block.next)
    if (self.pause || self.requestQueue.length >= self.bufferSize) return
    self._next()
  })
  this.requestCursor = null
}

BlockStream.prototype._getPeer = function () {
  if (this.peers instanceof Peer) return this.peers
  return this.peers.randomPeer()
}

// TODO: use a callback, rather than going through the on*Block methods
// TODO: add a timeout
BlockStream.prototype._getData = function (block) {
  var hash = u.toHash(block.header.hash)
  var inventory = [
    new Inventory({
      type: this.filtered ? Inventory.TYPE.FILTERED_BLOCK : Inventory.TYPE.BLOCK,
      hash: hash
    })
  ]
  var message = this.peers.messages.GetData(inventory)
  this._getPeer().sendMessage(message)
}

BlockStream.prototype._requestIndex = function (hash) {
  for (var i = 0; i < this.requestQueue.length; i++) {
    if (this.requestQueue[i] === null) return false
    if (hash.compare(this.requestQueue[i]) === 0) return i
  }
  return false
}

BlockStream.prototype._onBlock = function (message) {
  var hash = u.toHash(message.block.header.hash)
  var reqIndex = this._requestIndex(hash)
  if (reqIndex === false) return
  this._push(reqIndex, {
    height: this.requestHeight + reqIndex,
    header: message.block.header,
    block: message.block
  })
}

BlockStream.prototype._onMerkleBlock = function (message) {
  var self = this

  var hash = u.toHash(message.merkleBlock.header.hash)
  if (this._requestIndex(hash) === false) return

  var tree = MerkleTree.fromMerkleBlock(message.merkleBlock)
  if (!tree.txids.length) return done(null, [])
  this._getTransactions(tree.txids, done)

  function done (err, transactions) {
    if (err) return self._error(err)
    var reqIndex = self._requestIndex(hash)
    var height = self.requestHeight + reqIndex
    self._push(reqIndex, {
      height: height,
      header: message.merkleBlock.header,
      tree: tree,
      transactions: transactions
    })
  }
}

// TODO: maybe this should happen in Peer?
// TODO: add a timeout
BlockStream.prototype._getTransactions = function (txids, cb) {
  var self = this
  var inventory = txids.map(function (txid) {
    return new Inventory({
      type: Inventory.TYPE.TX,
      hash: u.toHash(txid)
    })
  })
  var peer = this._getPeer()
  var message = peer.messages.GetData(inventory)
  var remaining = txids.length
  var transactions = new Array(txids.length)
  function onTx (res) {
    var txid = u.toHash(res.transaction.id)
    for (var i = 0; i < txids.length; i++) {
      if (txids[i].compare(txid) === 0) break
    }
    if (i === txids.length) return
    transactions[i] = res.transaction
    remaining--
    if (remaining === 0) {
      self.removeListener('tx', onTx)
      cb(null, transactions)
    }
  }
  this.peers.on('tx', onTx)
  this.peers.sendMessage(message)
}

BlockStream.prototype._push = function (i, data) {
  this.buffer[i] = data
  while (this.buffer[0]) {
    this.requestHeight++
    this.requestQueue.shift()
    var head = this.buffer.shift()
    var more = this.push(head)
    if (!more) this.pause = true
  }
  if (this.requestQueue[0] === null) this.push(null)
}
