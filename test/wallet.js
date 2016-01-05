var test = require('tape')
var Networks = require('bitcore-lib').Networks
var Node = require('../lib/node.js')
// var Wallet = require('../lib/wallet.js')

test('Node wallet creation', function (t) {
  var node

  t.test('setup', function (t) {
    node = new Node({
      network: Networks.testnet,
      path: 'data/' + process.pid,
      to: 1000
    })
    node.on('ready', function () {
      node.createWallet('main', t.error)
      t.end()
    })
    node.on('error', t.error)
    node.start(t.error)
  })

  t.test('teardown', function (t) {
    node.close(t.end)
  })

  t.end()
})
