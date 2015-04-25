var test = require('tape')
var PeerGroup = require('../lib/peerGroup.js')
var BlockStore = require('../lib/blockStore.js')
var Blockchain = require('../lib/blockchain.js')

var storePath = 'data/' + process.pid + '.store'

test('creating blockchain instances', function (t) {
  t.plan(3)

  t.test('create blockchain without required options', function (t) {
    var chain, store
    t.throws(function () {
      chain = new Blockchain()
    })
    t.throws(function () {
      var peers = new PeerGroup()
      chain = new Blockchain({ peerGroup: peers })
    })
    t.throws(function () {
      store = new BlockStore({ path: storePath })
      chain = new Blockchain({ store: store })
    })
    chain || 0 // HACK to prevent JSHint warnings about not using `chain`
    store.close(t.end)
  })

  t.test('create blockchain with instantiated BlockStore', function (t) {
    t.doesNotThrow(function () {
      var peers = new PeerGroup()
      var store = new BlockStore({ path: storePath })
      var chain = new Blockchain({ peerGroup: peers, store: store })
      chain.store.close(t.end)
    })
  })

  t.test('create blockchain with path instead of BlockStore', function (t) {
    t.doesNotThrow(function () {
      var peers = new PeerGroup()
      var chain = new Blockchain({
        peerGroup: peers,
        path: storePath
      })
      chain.store.close(t.end)
    })
  })
})

test('blockchain sync', { timeout: 30 * 1000 }, function (t) {
  var peers = new PeerGroup()
  peers.connect()

  var store = new BlockStore({
    path: storePath,
    reset: function (err) {
      t.error(err)

      var chain = new Blockchain({ peerGroup: peers, store: store })

      chain.on('syncing', function (peer) {
        t.ok(peer)
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
        store.close(t.end)
      })
    }
  })
})
