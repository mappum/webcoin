var Readable = require('stream').Readable
var util = require('util')
var Inventory = require('bitcore-p2p').Inventory
var u = require('./utils.js')
var MerkleTree = require('./merkleTree.js')

var BlockStream = module.exports = function (opts) {
  if (!opts.peer) throw new Error('"peer" option is required for BlockStream')
  if (!opts.chain) throw new Error('"chain" option is required for BlockStream')
  Readable.call(this, { objectMode: true })

  opts = opts || {}
  this.peer = opts.peer
  this.chain = opts.chain
  this.network = this.chain.network
  this.from = opts.from || 0
  this.to = opts.to || null
  this.filtered = typeof opts.filtered === 'boolean' ? opts.filtered : !!this.peer.filter
  this.fetchTransactions = typeof opts.fetchTransactions === 'boolean' ? opts.fetchTransactions : true

  this.cursor = this.from
  this.expected = null
  this.ending = false

  if (!this.filtered) {
    this.peer.on('block', this._onBlock.bind(this))
  } else {
    this.peer.on('merkleblock', this._onMerkleBlock.bind(this))
  }
}
util.inherits(BlockStream, Readable)

BlockStream.prototype._error = function (err) {
  this.emit('error', err)
}

BlockStream.prototype._end = function () {
  this.ending = true
  if (this.expected) return
  this.push(null)
}

BlockStream.prototype._read = function () {
  this._next()
}

BlockStream.prototype._next = function () {
  var self = this
  if (this.expected) return
  this.chain.getBlock(this.cursor, function (err, block) {
    if (err) return self._error(err)
    if (!block.next) return self._end()
    self.cursor = u.toHash(block.next)
    if (u.toHash(block.header.hash).compare(self.from) === 0) return self._next()
    self._getData(block)
  })
}

BlockStream.prototype._getData = function (block) {
  var hash = u.toHash(block.header.hash)
  this.expected = { height: block.height, hash: hash }
  var inventory = [
    new Inventory({
      type: this.filtered ? Inventory.TYPE.FILTERED_BLOCK : Inventory.TYPE.BLOCK,
      hash: hash
    })
  ]
  var message = this.peer.messages.GetData(inventory)
  this.peer.sendMessage(message)
}

BlockStream.prototype._onBlock = function (message) {
  this._onData({
    height: this.expected.height,
    header: message.block.header,
    block: message.block
  })
}

BlockStream.prototype._onMerkleBlock = function (message) {
  if (!this.expected) return

  var tree = MerkleTree.fromMerkleBlock(message.merkleBlock)

  // TODO: fetch transactions

  this._onData({
    height: this.expected.height,
    header: message.merkleBlock.header,
    tree: tree,
    transactions: []
  })
}

BlockStream.prototype._onData = function (data) {
  if (!this.expected) return
  var hash = u.toHash(data.header.hash)
  if (hash.compare(this.expected.hash) !== 0) return
  this.expected = null
  var done = !this.push(data) || this.ending
  if (done) this._end()
  else this._next()
}
