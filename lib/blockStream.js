var Readable = require('stream').Readable
var util = require('util')
var Inventory = require('bitcore-p2p').Inventory
var u = require('./utils.js')

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

  this.cursor = this.from
  this.expected = null
  this.ending = false

  this.peer.on(this.filtered ? 'merkleblock' : 'block', this._onBlock.bind(this))
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
    self._getData(block)
  })
}

BlockStream.prototype._getData = function (block) {
  var hash = u.toHash(block.header.hash)
  this.expected = { height: block.height, hash: hash }
  var inventory = [
    new Inventory({
      type: this.filtered ? Inventory.TYPE.MERKLE_BLOCK : Inventory.TYPE.BLOCK,
      hash: hash
    })
  ]
  var message = this.peer.messages.GetData(inventory)
  this.peer.sendMessage(message)
}

BlockStream.prototype._onBlock = function (message) {
  if (!this.expected) return
  var hash = u.toHash(message.block.header.hash)
  if (hash.compare(this.expected.hash) !== 0) return
  var block = {
    height: this.expected.height,
    header: message.block.header,
    block: message.block
  }
  this.expected = null
  var done = !this.push(block) || this.ending
  if (done) this._end()
  else this._next()
}
