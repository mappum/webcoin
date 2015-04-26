var test = require('tape')
var bitcore = require('bitcore')
var BlockStore = require('../lib/blockStore.js')
var u = require('../lib/utils.js')

// TODO: get/setTip tests
// TODO: tests for put with { tip: true }

function createBlock () {
  var header = new bitcore.BlockHeader({
    version: 1,
    prevHash: u.toHash('0000000000000000000000000000000000000000000000000000000000000000'),
    merkleRoot: u.toHash('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'),
    time: Math.floor(Date.now() / 1000),
    bits: 0x1d00ffff,
    nonce: Math.floor(Math.random() * 0xffffff)
  })
  return { height: Math.floor(Math.random() * 400000), header: header }
}

var storePath = 'data/' + process.pid + '.store'

test('open blockstore', function (t) {
  var bs1 = new BlockStore({ path: storePath }, t.error)
  bs1.on('error', t.error)

  t.test('opening on a path that is already locked', function (t) {
    var bs2 = new BlockStore({ path: storePath }, function (err) {
      t.ok(err)
      t.end()
    })
    bs2.on('error', t.error)
  })

  t.test('closing', function (t) {
    bs1.close(t.end)
  })

  t.end()
})

test('blockstore put', function (t) {
  var bs = new BlockStore({ path: storePath })
  var block = createBlock()

  t.test('simple put', function (t) {
    bs.put(block, t.end)
  })
  t.test('put existing block', function (t) {
    bs.put(block, t.end)
  })
  t.test('put invalid blocks', function (t) {
    t.plan(3)
    bs.put({}, t.ok)
    bs.put({ height: 123 }, t.ok)
    bs.put({ header: block.header }, t.ok)
  })
  t.test('put after close', function (t) {
    t.plan(2)
    bs.close(function (err) {
      t.error(err)
      bs.put(block, t.ok)
    })
  })
})

test('blockstore get', function (t) {
  t.plan(6)

  var bs = new BlockStore({ path: storePath })
  var block1 = createBlock()
  bs.put(block1, function (err) {
    t.error(err)

    t.test('get using `header.hash`', function (t) {
      bs.get(block1.header.hash, function (err, block2) {
        t.error(err)
        // compare blocks
        t.equal(block1.height, block2.height)
        // NOTE: we have to access `header.hash` before comparing headers,
        // for the hash to actually be computed and cached
        t.equal(block1.header.hash, block2.header.hash)
        t.deepEqual(block1.header, block2.header)
        t.end()
      })
    })

    t.test('get using buffer hash', function (t) {
      bs.get(block1.header._getHash(), function (err, block2) {
        t.error(err)
        // compare blocks
        t.equal(block1.height, block2.height)
        // NOTE: we have to access `header.hash` before comparing headers,
        // for the hash to actually be computed and cached
        t.equal(block1.header.hash, block2.header.hash)
        t.deepEqual(block1.header, block2.header)
        t.end()
      })
    })

    t.test('get an invalid hash', function (t) {
      bs.get('1234', function (err, block2) {
        t.ok(err)
        t.equal(err.message, 'Invalid hash format')
        t.notOk(block2)
        t.end()
      })
    })

    t.test('get a valid, nonexistent hash', function (t) {
      var block3 = createBlock()
      bs.get(block3.header.hash, function (err, block2) {
        t.ok(err)
        t.equal(err.name, 'NotFoundError')
        t.notOk(block2)
        t.end()
      })
    })

    t.test('closing', function (t) {
      bs.close(t.end)
    })
  })
})
