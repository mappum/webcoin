var util = require('util')
var bitcore = require('bitcore')
var _ = bitcore.deps._
var $ = bitcore.util.preconditions
var BufferUtil = bitcore.util.buffer
var JSUtil = bitcore.util.js
var BlockHeader = bitcore.BlockHeader
var BufferReader = bitcore.encoding.BufferReader
var BufferWriter = bitcore.encoding.BufferWriter
var Script = bitcore.Script

var zeroHash = new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex')

var PrivateBlockHeader = module.exports = function (arg) {
  if (!(this instanceof PrivateBlockHeader)) {
    return new PrivateBlockHeader(arg)
  }
  _.extend(this, PrivateBlockHeader._from(arg))
  return this
}
util.inherits(PrivateBlockHeader, BlockHeader)

PrivateBlockHeader._from = function _from (arg) {
  var info = {}
  if (BufferUtil.isBuffer(arg)) {
    info = PrivateBlockHeader._fromBufferReader(BufferReader(arg))
  } else if (JSUtil.isValidJSON(arg)) {
    info = PrivateBlockHeader._fromJSON(arg)
  } else if (_.isObject(arg)) {
    info = PrivateBlockHeader._fromObject(arg)
  } else {
    throw new TypeError('Unrecognized argument for PrivateBlockHeader')
  }
  return info
}

PrivateBlockHeader._fromJSON = function _fromJSON (data) {
  $.checkArgument(JSUtil.isValidJSON(data), 'data must be a valid JSON string')
  data = JSON.parse(data)
  return PrivateBlockHeader._fromObject(data)
}

PrivateBlockHeader._fromObject = function _fromObject (data) {
  $.checkArgument(data, 'data is required')
  var prevHash = data.prevHash
  var merkleRoot = data.merkleRoot
  if (_.isString(data.prevHash)) {
    prevHash = BufferUtil.reverse(new Buffer(data.prevHash, 'hex'))
  }
  if (_.isString(data.merkleRoot)) {
    merkleRoot = BufferUtil.reverse(new Buffer(data.merkleRoot, 'hex'))
  }
  var info = {
    version: data.version,
    prevHash: prevHash,
    merkleRoot: merkleRoot,
    time: data.time,
    timestamp: data.time,
    challenge: new Script(data.challenge),
    solution: new Script(data.solution)
  }
  return info
}

PrivateBlockHeader.fromJSON = function fromJSON (json) {
  var info = PrivateBlockHeader._fromJSON(json)
  return new PrivateBlockHeader(info)
}

PrivateBlockHeader.fromObject = function fromObject (obj) {
  var info = PrivateBlockHeader._fromObject(obj)
  return new PrivateBlockHeader(info)
}

PrivateBlockHeader.fromRawBlock = function fromRawBlock (data) {
  if (!BufferUtil.isBuffer(data)) {
    data = new Buffer(data, 'binary')
  }
  var br = BufferReader(data)
  br.pos = PrivateBlockHeader.Constants.START_OF_HEADER
  var info = PrivateBlockHeader._fromBufferReader(br)
  return new PrivateBlockHeader(info)
}

PrivateBlockHeader.fromBuffer = function fromBuffer (buf) {
  var info = PrivateBlockHeader._fromBufferReader(BufferReader(buf))
  return new PrivateBlockHeader(info)
}

PrivateBlockHeader.fromString = function fromString (str) {
  var buf = new Buffer(str, 'hex')
  return PrivateBlockHeader.fromBuffer(buf)
}

PrivateBlockHeader._fromBufferReader = function _fromBufferReader (br) {
  var info = {}
  info.version = br.readUInt32LE()
  info.prevHash = br.read(32)
  info.merkleRoot = br.read(32)
  info.time = br.readUInt32LE()
  info.challenge = new Script(br.readVarLengthBuffer())
  if (info.prevHash.compare(zeroHash) !== 0 && br.buf.length > br.pos) {
    info.solution = new Script(br.readVarLengthBuffer())
  }
  return info
}

PrivateBlockHeader.fromBufferReader = function fromBufferReader (br) {
  var info = PrivateBlockHeader._fromBufferReader(br)
  return new PrivateBlockHeader(info)
}

PrivateBlockHeader.prototype.toObject = function toObject () {
  return {
    version: this.version,
    prevHash: BufferUtil.reverse(this.prevHash).toString('hex'),
    merkleRoot: BufferUtil.reverse(this.merkleRoot).toString('hex'),
    time: this.time,
    challenge: new Script(this.challenge),
    solution: new Script(this.solution)
  }
}

PrivateBlockHeader.prototype.toJSON = function toJSON () {
  return JSON.stringify(this.toObject())
}

PrivateBlockHeader.prototype.toBuffer = function toBuffer (solution) {
  return this.toBufferWriter(null, solution).concat()
}

PrivateBlockHeader.prototype.toString = function toString () {
  return this.toBuffer().toString('hex')
}

PrivateBlockHeader.prototype.toBufferWriter = function toBufferWriter (bw, solution) {
  if (!bw) {
    bw = new BufferWriter()
  }
  bw.writeUInt32LE(this.version)
  bw.write(this.prevHash)
  bw.write(this.merkleRoot)
  bw.writeUInt32LE(this.time)
  var challengeBuf = this.challenge.toBuffer()
  bw.writeVarintNum(challengeBuf.length)
  bw.write(challengeBuf)
  if (solution) {
    var solutionBuf = this.solution.toBuffer()
    bw.writeVarintNum(solutionBuf.length)
    bw.write(solutionBuf)
  }
  return bw
}

PrivateBlockHeader.prototype.validSolution = function validSolution () {
  // TODO: verify solution
  return true
}

PrivateBlockHeader.prototype.inspect = function inspect () {
  return '<PrivateBlockHeader ' + this.id + '>'
}
