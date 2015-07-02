var test = require('tape')
var bitcore = require('bitcore')
var BN = bitcore.crypto.BN
var PeerGroup = require('../lib/peerGroup.js')
var BlockStore = require('../lib/blockStore.js')
var Blockchain = require('../lib/blockchain.js')
var u = require('../lib/utils.js')
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

var maxTarget = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex')
function createBlock (prev, nonce, bits) {
  var i = nonce || 0
  var header
  do {
    header = new bitcore.BlockHeader({
      version: 1,
      prevHash: prev ? u.toHash(prev.hash) : constants.zeroHash,
      merkleRoot: constants.zeroHash,
      time: prev ? (prev.time + 1) : Math.floor(Date.now() / 1000),
      bits: bits || (prev ? prev.bits : u.toCompactTarget(maxTarget)),
      nonce: i++
    })
  } while (!header.validProofOfWork())
  return header
}

var storePath = 'data/' + process.pid + '.store'

test('creating blockchain instances', function (t) {
  t.plan(2)

  t.test('create blockchain with instantiated BlockStore', function (t) {
    t.doesNotThrow(function () {
      var peers = new PeerGroup()
      var store = new BlockStore({ path: storePath })
      var chain = new Blockchain({ peerGroup: peers, store: store })
      endStore(chain.store, t)
    })
  })

  t.test('create blockchain with path instead of BlockStore', function (t) {
    t.doesNotThrow(function () {
      var peers = new PeerGroup()
      var chain = new Blockchain({ peerGroup: peers, path: storePath })
      endStore(chain.store, t)
    })
  })
})

test('blockchain paths', function (t) {
  var genesis = new bitcore.BlockHeader({
    version: 1,
    prevHash: constants.zeroHash,
    merkleRoot: constants.zeroHash,
    time: Math.floor(Date.now() / 1000),
    bits: u.toCompactTarget(maxTarget),
    nonce: 0
  })
  var chain = new Blockchain({
    path: storePath,
    maxTarget: maxTarget,
    genesis: genesis
  })

  var headers = []
  t.test('headers add to blockchain', function (t) {
    var block = genesis
    for (var i = 0; i < 10; i++) {
      block = createBlock(block)
      headers.push(block)
    }
    chain.processHeaders(headers, t.end)
  })

  t.test('simple path with no fork', function (t) {
    var from = { height: 2, header: headers[1] }
    var to = { height: 10, header: headers[9] }
    chain.getPath(from, to, function (err, path) {
      if (err) return t.end(err)
      t.ok(path)
      t.ok(path.add)
      t.ok(path.remove)
      t.notOk(path.fork)
      t.equal(path.add.length, 8)
      t.equal(path.add[0].height, 3)
      t.equal(path.add[0].header.hash, headers[2].hash)
      t.equal(path.add[7].height, 10)
      t.equal(path.add[7].header.hash, to.header.hash)
      t.equal(path.remove.length, 0)
      t.end()
    })
  })

  t.test('backwards path with no fork', function (t) {
    var from = { height: 10, header: headers[9] }
    var to = { height: 2, header: headers[1] }
    chain.getPath(from, to, function (err, path) {
      if (err) return t.end(err)
      t.ok(path)
      t.ok(path.add)
      t.ok(path.remove)
      t.notOk(path.fork)
      t.equal(path.remove.length, 8)
      t.equal(path.remove[0].height, 10)
      t.equal(path.remove[0].header.hash, from.header.hash)
      t.equal(path.remove[7].height, 3)
      t.equal(path.remove[7].header.hash, headers[2].hash)
      t.equal(path.add.length, 0)
      t.end()
    })
  })

  var headers2 = []
  t.test('fork headers add to blockchain', function (t) {
    var block = headers[4]
    for (var i = 0; i < 10; i++) {
      block = createBlock(block, 0xffffff)
      headers2.push(block)
    }
    chain.processHeaders(headers2, t.end)
  })

  t.test('path with fork', function (t) {
    var from = { height: 10, header: headers[9] }
    var to = { height: 15, header: headers2[9] }
    chain.getPath(from, to, function (err, path) {
      if (err) return t.end(err)
      t.ok(path)
      t.ok(path.add)
      t.ok(path.remove)
      t.equal(path.fork.header.hash, headers[4].hash)
      t.equal(path.remove.length, 5)
      t.equal(path.remove[0].height, 10)
      t.equal(path.remove[0].header.hash, from.header.hash)
      t.equal(path.remove[4].height, 6)
      t.equal(path.remove[4].header.hash, headers[5].hash)
      t.equal(path.add.length, 10)
      t.equal(path.add[0].height, 6)
      t.equal(path.add[0].header.hash, headers2[0].hash)
      t.equal(path.add[9].height, 15)
      t.equal(path.add[9].header.hash, headers2[9].hash)
      t.end()
    })
  })

  t.test('backwards path with fork', function (t) {
    var from = { height: 15, header: headers2[9] }
    var to = { height: 10, header: headers[9] }
    chain.getPath(from, to, function (err, path) {
      if (err) return t.end(err)
      t.ok(path)
      t.ok(path.add)
      t.ok(path.remove)
      t.equal(path.fork.header.hash, headers[4].hash)
      t.equal(path.remove.length, 10)
      t.equal(path.remove[0].height, 15)
      t.equal(path.remove[0].header.hash, from.header.hash)
      t.equal(path.remove[9].height, 6)
      t.equal(path.remove[9].header.hash, headers2[0].hash)
      t.equal(path.add.length, 5)
      t.equal(path.add[0].height, 6)
      t.equal(path.add[0].header.hash, headers[5].hash)
      t.equal(path.add[4].height, 10)
      t.equal(path.add[4].header.hash, headers[9].hash)
      t.end()
    })
  })

  t.test('deleting blockstore', function (t) {
    endStore(chain.store, t)
  })
})

test('blockchain verification', function (t) {
  var genesis = new bitcore.BlockHeader({
    version: 1,
    prevHash: constants.zeroHash,
    merkleRoot: constants.zeroHash,
    time: Math.floor(Date.now() / 1000),
    bits: u.toCompactTarget(maxTarget),
    nonce: 0
  })
  var chain = new Blockchain({
    path: storePath,
    maxTarget: maxTarget,
    genesis: genesis,
    interval: 10
  })

  var headers = []
  t.test('headers add to blockchain', function (t) {
    var block = genesis
    for (var i = 0; i < 9; i++) {
      block = createBlock(block)
      headers.push(block)
    }
    chain.processHeaders(headers, t.end)
  })

  t.test("error on header that doesn't connect", function (t) {
    var block = createBlock()
    chain.processHeaders([ block ], function (err) {
      t.ok(err)
      t.equal(err.message, 'Block does not connect to chain')
      t.end()
    })
  })

  t.test('error on nonconsecutive headers', function (t) {
    var block1 = createBlock(headers[5], 10000)
    var block2 = createBlock(headers[6], 10000)

    chain.processHeaders([ block1, block2 ], function (err) {
      t.ok(err)
      t.equal(err.message, 'Block does not connect to previous')
      t.end()
    })
  })

  t.test('error on header with unexpected difficulty change', function (t) {
    var block = createBlock(headers[5])
    block.bits = 0x1d00ffff
    chain.processHeaders([ block ], function (err) {
      t.ok(err)
      t.equal(err.message, 'Unexpected difficulty change')
      t.end()
    })
  })

  t.test('error on header with invalid proof of work', function (t) {
    var block = createBlock(headers[8])
    block.bits = 0x00000001
    chain.processHeaders([ block ], function (err) {
      t.ok(err)
      t.equal(err.message, 'Invalid proof of work')
      t.end()
    })
  })

  t.test('error on header with invalid difficulty change', function (t) {
    var block = createBlock(headers[8], 0, 0x2200ffff)
    chain.processHeaders([ block ], function (err) {
      t.ok(err)
      t.equal(err.message, 'Bits in block (2200ffff) is different than expected (213fffc0)')
      t.end()
    })
  })

  t.test('accept valid difficulty change', function (t) {
    var block = createBlock(headers[8], 0, 0x213fffc0)
    chain.processHeaders([ block ], t.end)
  })

  t.test('teardown', function (t) {
    endStore(chain.store, t)
  })
})

test('blockchain queries', function (t) {
  var genesis = new bitcore.BlockHeader({
    version: 1,
    prevHash: constants.zeroHash,
    merkleRoot: constants.zeroHash,
    time: Math.floor(Date.now() / 1000),
    bits: u.toCompactTarget(maxTarget),
    nonce: 0
  })
  var chain = new Blockchain({
    path: storePath,
    maxTarget: maxTarget,
    genesis: genesis
  })

  var headers = []
  t.test('setup', function (t) {
    var block = genesis
    for (var i = 0; i < 100; i++) {
      block = createBlock(block)
      headers.push(block)
    }
    chain.processHeaders(headers, t.end)
  })

  t.test('get block at height', function (t) {
    t.plan(14)

    chain.getBlockAtHeight(10, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 10)
      t.equal(block.header.hash, headers[9].hash)
    })

    chain.getBlockAtHeight(90, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 90)
      t.equal(block.header.hash, headers[89].hash)
    })

    chain.getBlockAtHeight(200, function (err, block) {
      t.ok(err)
      t.notOk(block)
      t.equal(err.message, 'height is higher than tip')
    })

    chain.getBlockAtHeight(-10, function (err, block) {
      t.ok(err)
      t.notOk(block)
      t.equal(err.message, 'height must be >= 0')
    })
  })

  t.test('get block at time', function (t) {
    t.plan(16)

    chain.getBlockAtTime(genesis.time + 10, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 10)
      t.equal(block.header.hash, headers[9].hash)
    })

    chain.getBlockAtTime(genesis.time + 90, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 90)
      t.equal(block.header.hash, headers[89].hash)
    })

    chain.getBlockAtTime(genesis.time + 200, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 100)
      t.equal(block.header.hash, headers[99].hash)
    })

    chain.getBlockAtTime(genesis.time - 10, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 0)
      t.equal(block.header.hash, genesis.hash)
    })
  })

  t.test('get block', function (t) {
    t.plan(14)

    chain.getBlock(u.toHash(headers[50].hash), function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 51)
      t.equal(block.header.hash, headers[50].hash)
    })

    chain.getBlock(10, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 10)
      t.equal(block.header.hash, headers[9].hash)
    })

    chain.getBlock(genesis.time + 20, function (err, block) {
      t.error(err)
      t.ok(block)
      t.equal(block.height, 20)
      t.equal(block.header.hash, headers[19].hash)
    })

    chain.getBlock(':)', function (err, block) {
      t.ok(err)
      t.equal(err.message, '"at" must be a block hash, height, or timestamp')
    })
  })

  t.test('teardown', function (t) {
    endStore(chain.store, t)
  })
})

test('blockchain sync', function (t) {
  var peers = new PeerGroup()
  peers.on('error', function (err) { console.error(err) })
  peers.connect()

  var store, chain

  t.test('setup', function (t) {
    store = new BlockStore({
      path: storePath,
      reset: function (err) {
        t.error(err, 'opened BlockStore')
        chain = new Blockchain({ peerGroup: peers, store: store })
        t.end()
      }
    })
  })

  t.test('sync', function (t) {
    t.plan(6)
    chain.on('syncing', function (peer) {
      t.ok(peer, 'downloading from peer')
    })
    chain.on('synced', function (tip) {
      t.ok(tip)
      t.equal(tip.height, 3000)
    })
    chain.sync({ to: 3000 }, function (block) {
      t.ok(block)
      t.equal(block.height, 3000)
      t.equal(block.header.hash, '000000004a81b9aa469b11649996ecb0a452c16d1181e72f9f980850a1c5ecce')

      peers.disconnect()
      t.end()
    })
  })

  t.test('teardown', function (t) {
    endStore(store, t)
  })
  t.end()
})
