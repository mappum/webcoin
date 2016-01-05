var test = require('tape')
var Networks = require('bitcore-lib').Networks
var Node = require('../lib/node.js')

test('Node constructor', function (t) {
  var HEIGHT = 1000
  var node

  t.test('setup', function (t) {
    t.plan(1)
    node = new Node({
      network: Networks.testnet,
      path: 'data/' + process.pid,
      to: HEIGHT
    })
    node.start(t.error)
  })

  t.test('chain', function (t) {
    node.chain.on('synced', function () {
      var tip = node.chain.tip
      t.equal(tip.height, HEIGHT)
      t.equal(tip.header.hash, '00000000373403049c5fff2cd653590e8cbe6f7ac639db270e7d1a7503d698df')
      t.notOk(node.chain.syncing)
      t.end()
    })
  })

  t.test('teardown', function (t) {
    node.close(t.end)
  })

  t.end()
})
