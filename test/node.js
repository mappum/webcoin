var test = require('tape')
var Networks = require('bitcore').Networks
var Node = require('../lib/node.js')

test('Node constructor', function (t) {
  var node

  t.test('setup', function (t) {
    t.plan(1)
    node = new Node({
      network: Networks.testnet,
      path: 'data/' + process.pid,
      to: 1000
    })
    node.start(t.error)
  })

  t.test('teardown', function (t) {
    node.close(t.end)
  })

  t.end()
})
