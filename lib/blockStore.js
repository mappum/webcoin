var EventEmitter = require('events').EventEmitter
var util = require('util')
var bitcore = require('bitcore')
var buffertools = require('buffertools')
var u = require('./utils.js')

function cloneBuffer (a) {
  var b = new Buffer(a.length)
  a.copy(b)
  return b
}

function encodeKey (hash) {
  if (Buffer.isBuffer(hash)) return buffertools.reverse(cloneBuffer(hash)).toString('base64')
  if (typeof hash === 'string') {
    if (hash.length === 44) return hash
    if (hash.length === 64) return new Buffer(hash, 'hex').toString('base64')
  }
  throw new Error('Invalid hash format')
}

var BlockStore = module.exports = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = null
  }
  opts = opts || {}

  this.store = opts.store || u.createStore({ path: opts.path, db: opts.db }, cb)
  if (opts.reset) {
    this.store.del('tip', typeof opts.reset === 'function' ? opts.reset : null)
  }
}
util.inherits(BlockStore, EventEmitter)

BlockStore.prototype.put = function (block, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (block.height == null) return cb(new Error('Must specify height'))
  if (block.header == null) return cb(new Error('Must specify header'))
  if (!(block.header instanceof bitcore.BlockHeader)) {
    return cb(new Error('Header must be instance of BlockHeader'))
  }
  if (opts.tip) opts.best = true

  var self = this
  var blockJson = JSON.stringify({
    height: block.height,
    header: block.header.toBuffer().toString('base64')
  })
  var batch = [
    { type: 'put', key: encodeKey(block.header.hash), value: blockJson }
  ]
  if (opts.best && opts.prev) {
    var prevJson = JSON.stringify({
      height: opts.prev.height,
      header: opts.prev.header.toBuffer().toString('base64'),
      next: block.header.hash
    })
    batch.push({ type: 'put', key: encodeKey(opts.prev.header.hash), value: prevJson })
  }
  this.store.batch(batch, function (err) {
    if (err) return cb(err)
    if (opts.tip) {
      return self._setTip({ height: block.height, hash: block.header.hash }, cb)
    }
    cb(null)
  })
}

BlockStore.prototype.get = function (hash, cb) {
  try {
    var key = encodeKey(hash)
  } catch(err) {
    return cb(err)
  }

  this.store.get(key, function (err, block) {
    if (err) return cb(err)
    try {
      block = JSON.parse(block)
    } catch(err) {
      return cb('Invalid header value: ' + err)
    }
    var header = new Buffer(block.header, 'base64')
    block.header = bitcore.BlockHeader.fromBuffer(header)
    cb(null, block)
  })
}

BlockStore.prototype._setTip = function (tip, cb) {
  var newTip = {}
  for (var k in tip) newTip[k] = tip[k]
  delete newTip.header
  this.store.put('tip', JSON.stringify(newTip), cb)
}

BlockStore.prototype.getTip = function (cb) {
  var self = this
  this.store.get('tip', function (err, tip) {
    if (err) return cb(err)
    try {
      tip = JSON.parse(tip)
    } catch(err) {
      return cb('Invalid tip value: ' + err)
    }

    self.get(tip.hash, function (err, block) {
      if (err) return cb(err)
      tip.hash = u.toHash(tip.hash)
      tip.header = block.header
      cb(null, tip)
    })
  })
}

BlockStore.prototype.close = function (cb) {
  this.store.close(cb)
}

BlockStore.prototype.isClosed = function () {
  return this.store.isClosed()
}

BlockStore.prototype.isOpen = function () {
  return this.store.isOpen()
}
