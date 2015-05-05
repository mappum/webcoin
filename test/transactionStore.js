var crypto = require('crypto')
var test = require('tape')
var Transaction = require('bitcore').Transaction
var TransactionStore = require('../lib/transactionStore.js')
var constants = require('../lib/constants.js')

try {
  var leveldown = require('leveldown')
} catch(err) {}

function deleteStore (store, cb) {
  if (leveldown) {
    return leveldown.destroy(store.store.location, cb)
  }
  cb(null)
}

function endStore (store, t) {
  store.close(function (err) {
    t.error(err)
    deleteStore(store, t.end)
  })
}

function createTransaction () {
  var tx = new Transaction()
  tx.addData(crypto.pseudoRandomBytes(16))
  return tx
}

var storePath = 'data/' + process.pid + '.store'

var ts
test('creating TransactionStore instances', function (t) {
  t.test('error when no path specified', function (t) {
    t.throws(function () {
      ts = new TransactionStore()
      t.notOk(ts)
    }, /constructor requires at least a location argument/)
    t.end()
  })

  t.test('no error when path is specified', function (t) {
    t.doesNotThrow(function () {
      ts = new TransactionStore({ path: storePath }, t.end)
      t.ok(ts)
    })
  })

  t.test('isOpen() returns true after init callback', function (t) {
    t.ok(ts.isOpen())
    t.end()
  })

  t.test('isClosed() returns false after init callback', function (t) {
    t.notOk(ts.isClosed())
    t.end()
  })

  t.end()
})

test('TransactionStore put', function (t) {
  t.test('error when putting with no block', function (t) {
    ts.put(createTransaction(), function (err) {
      t.ok(err)
      t.equal(err.message, 'Must specify "header" or "block" option')
      t.end()
    })
  })

  t.test('put succeeds with block or header', function (t) {
    t.plan(2)
    ts.put(createTransaction(), { block: constants.zeroHash }, t.error)
    ts.put(createTransaction(), { header: constants.genesisHeaders.livenet }, t.error)
  })

  t.test('error when putting invalid data', function (t) {
    ts.put({ foo: 'bar' }, { block: constants.zeroHash }, function (err) {
      t.ok(err)
      t.equal(err.message, 'Transaction must be instance of bitcore.Transaction')
      t.end()
    })
  })

  t.test('error when putting with invalid block hash', function (t) {
    t.throws(function () {
      ts.put(createTransaction(), { block: 'block' }, t.error)
    }, /Invalid hex string/)
    t.end()
  })

  t.test('put succeeds for duplicate entries', function (t) {
    t.plan(2)
    var tx = createTransaction()
    ts.put(tx, { block: constants.zeroHash }, t.error)
    ts.put(tx, { block: constants.zeroHash }, t.error)
  })
})

test('TransactionStore get', function (t) {
  var tx
  t.test('setup', function (t) {
    tx = createTransaction()
    ts.put(tx, { block: constants.zeroHash }, t.end)
  })

  t.test('simple get', function (t) {
    ts.get(tx.hash, function (err, getTx) {
      t.error(err)
      t.ok(getTx)
      t.equal(getTx.block, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
      t.ok(getTx.transaction)
      t.ok(getTx.transaction instanceof Transaction)
      t.equal(tx.hash, getTx.transaction.hash)
      t.end()
    })
  })

  t.test('error when getting with invalid hash', function (t) {
    ts.get('test :)', function (err) {
      t.ok(err)
      t.end()
    })
  })
})

test('teardown', function (t) {
  endStore(ts, t)

  t.test('isOpen() returns false after close callback', function (t) {
    t.notOk(ts.isOpen())
    t.end()
  })

  t.test('isClosed() returns true after close callback', function (t) {
    t.ok(ts.isClosed())
    t.end()
  })
})
