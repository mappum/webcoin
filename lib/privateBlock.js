var util = require('util')
var bitcore = require('bitcore')
var _ = bitcore.deps._
var BN = bitcore.deps.BN
var $ = bitcore.util.preconditions
var BufferUtil = bitcore.util.buffer
var JSUtil = bitcore.util.js
var Hash = bitcore.Hash
var Block = bitcore.Block
var Transaction = bitcore.Transaction
var BufferReader = bitcore.encoding.BufferReader
var BufferWriter = bitcore.encoding.BufferWriter
var PrivateBlockHeader = require('./privateBlockHeader.js')

var PrivateBlock = module.exports = function (arg) {
  if (!(this instanceof PrivateBlock)) {
    return new PrivateBlock(arg)
  }
  _.extend(this, PrivateBlock._from(arg))
  return this
}
util.inherits(PrivateBlock, Block)

PrivateBlock._from = function _from (arg) {
  var info = {}
  if (BufferUtil.isBuffer(arg)) {
    info = PrivateBlock._fromBufferReader(BufferReader(arg))
  } else if (JSUtil.isValidJSON(arg)) {
    info = PrivateBlock._fromJSON(arg)
  } else if (_.isObject(arg)) {
    info = PrivateBlock._fromObject(arg)
  } else {
    throw new TypeError('Unrecognized argument for PrivateBlock')
  }
  return info
}

PrivateBlock._fromJSON = function _fromJSON (data) {
  $.checkArgument(JSUtil.isValidJSON(data), 'data must be valid JSON')
  data = JSON.parse(data)
  return PrivateBlock._fromObject(data)
}

PrivateBlock._fromObject = function _fromObject (data) {
  var transactions = []
  data.transactions.forEach(function (tx) {
    transactions.push(Transaction().fromJSON(tx))
  })
  var info = {
    header: PrivateBlockHeader.fromObject(data.header),
    transactions: transactions
  }
  return info
}

PrivateBlock.fromJSON = function fromJSON (json) {
  var info = PrivateBlock._fromJSON(json)
  return new PrivateBlock(info)
}

PrivateBlock.fromObject = function fromObject (obj) {
  var info = PrivateBlock._fromObject(obj)
  return new PrivateBlock(info)
}

PrivateBlock._fromBufferReader = function _fromBufferReader (br) {
  var info = {}
  $.checkState(!br.finished(), 'No block data received')
  info.header = PrivateBlockHeader.fromBufferReader(br)
  var transactions = br.readVarintNum()
  info.transactions = []
  for (var i = 0; i < transactions; i++) {
    info.transactions.push(Transaction().fromBufferReader(br))
  }
  return info
}

PrivateBlock.fromBufferReader = function fromBufferReader (br) {
  $.checkArgument(br, 'br is required')
  var info = PrivateBlock._fromBufferReader(br)
  return new PrivateBlock(info)
}

PrivateBlock.fromBuffer = function fromBuffer (buf) {
  return PrivateBlock.fromBufferReader(new BufferReader(buf))
}

PrivateBlock.fromString = function fromString (str) {
  var buf = new Buffer(str, 'hex')
  return PrivateBlock.fromBuffer(buf)
}

PrivateBlock.fromRawBlock = function fromRawBlock (data) {
  if (!BufferUtil.isBuffer(data)) {
    data = new Buffer(data, 'binary')
  }
  var br = BufferReader(data)
  br.pos = PrivateBlock.Values.START_OF_BLOCK
  var info = PrivateBlock._fromBufferReader(br)
  return new PrivateBlock(info)
}

PrivateBlock.prototype.toObject = function toObject () {
  var transactions = []
  this.transactions.forEach(function (tx) {
    transactions.push(tx.toObject())
  })
  return {
    header: this.header.toObject(),
    transactions: transactions
  }
}

PrivateBlock.prototype.toJSON = function toJSON () {
  return JSON.stringify(this.toObject())
}

PrivateBlock.prototype.toBuffer = function toBuffer () {
  return this.toBufferWriter().concat()
}

PrivateBlock.prototype.toString = function toString () {
  return this.toBuffer().toString('hex')
}

PrivateBlock.prototype.toBufferWriter = function toBufferWriter (bw) {
  if (!bw) {
    bw = new BufferWriter()
  }
  bw.write(this.header.toBuffer())
  bw.writeVarintNum(this.transactions.length)
  for (var i = 0; i < this.transactions.length; i++) {
    this.transactions[i].toBufferWriter(bw)
  }
  return bw
}

PrivateBlock.prototype.getTransactionHashes = function getTransactionHashes () {
  var hashes = []
  if (this.transactions.length === 0) {
    return [PrivateBlock.Values.NULL_HASH]
  }
  for (var t = 0; t < this.transactions.length; t++) {
    hashes.push(this.transactions[t]._getHash())
  }
  return hashes
}

PrivateBlock.prototype.getMerkleTree = function getMerkleTree () {

  var tree = this.getTransactionHashes()

  var j = 0
  for (var size = this.transactions.length; size > 1; size = Math.floor((size + 1) / 2)) {
    for (var i = 0; i < size; i += 2) {
      var i2 = Math.min(i + 1, size - 1)
      var buf = Buffer.concat([tree[j + i], tree[j + i2]])
      tree.push(Hash.sha256sha256(buf))
    }
    j += size
  }

  return tree
}

PrivateBlock.prototype.getMerkleRoot = function getMerkleRoot () {
  var tree = this.getMerkleTree()
  return tree[tree.length - 1]
}

PrivateBlock.prototype.validMerkleRoot = function validMerkleRoot () {

  var h = new BN(this.header.merkleRoot.toString('hex'), 'hex')
  var c = new BN(this.getMerkleRoot().toString('hex'), 'hex')

  if (h.cmp(c) !== 0) {
    return false
  }

  return true
}

PrivateBlock.prototype._getHash = function () {
  return this.header._getHash()
}

var idProperty = {
  configurable: false,
  writeable: false,
  get: function () {
    if (!this._id) {
      this._id = this.header.id
    }
    return this._id
  },
  set: _.noop
}
Object.defineProperty(PrivateBlock.prototype, 'id', idProperty)
Object.defineProperty(PrivateBlock.prototype, 'hash', idProperty)

PrivateBlock.prototype.inspect = function inspect () {
  return '<PrivateBlock ' + this.id + '>'
}
