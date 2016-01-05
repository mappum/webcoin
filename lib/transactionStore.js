var bitcore = require('bitcore-lib')
var Transaction = bitcore.Transaction
var u = require('./utils.js')

function encodeKey (hash) {
  if (typeof hash === 'string') {
    return new Buffer(hash, 'hex').toString('base64')
  } else if (Buffer.isBuffer(hash)) {
    return hash.toString('base64')
  }
}

var TransactionStore = module.exports = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = null
  }
  opts = opts || {}
  this.store = opts.store || u.createStore({ path: opts.path, db: opts.db }, cb)
}

TransactionStore.prototype.put = function (tx, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.header && !opts.block) return cb(new Error('Must specify "header" or "block" option'))
  if (!(tx instanceof Transaction)) {
    return cb(new Error('Transaction must be instance of bitcore.Transaction'))
  }

  var blockKey = encodeKey(opts.header ? opts.header.hash : opts.block)
  var txKey = encodeKey(tx.hash)

  this.store.get(txKey, function (err, existingTx) {
    if (err && !err.notFound) return cb(err)
    if (existingTx) return cb(null, tx, { existed: true })
    self.store.get(blockKey, function (err, blockIndex) {
      if (err && !err.notFound) return cb(err)
      blockIndex = blockIndex || []
      blockIndex.push(txKey)
      var batch = [
        { type: 'put',
          key: txKey,
          value: {
            block: blockKey,
            data: tx.toBuffer().toString('base64')
          }
        },
        { type: 'put', key: blockKey, value: blockIndex }
      ]
      self.store.batch(batch, function (err) {
        if (err) return cb(err)
        return cb(null, tx, { existed: false })
      })
    })
  })
}

TransactionStore.prototype.get = function (hash, cb) {
  try {
    var key = encodeKey(hash)
  } catch (err) {
    return cb(err)
  }

  this.store.get(key, function (err, tx) {
    if (err) return cb(err)
    if (tx.data) {
      // value is a transaction (not a block index)
      tx.transaction = new Transaction(new Buffer(tx.data, 'base64'))
      delete tx.data
    }
    cb(null, tx)
  })
}

TransactionStore.prototype.close = function (cb) {
  this.store.close(cb)
}

TransactionStore.prototype.isClosed = function () {
  return this.store.isClosed()
}

TransactionStore.prototype.isOpen = function () {
  return this.store.isOpen()
}
