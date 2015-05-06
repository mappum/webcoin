var test = require('tape')
var bitcore = require('bitcore')
var BN = bitcore.crypto.BN
var u = require('../lib/utils.js')

test('toHash', function (t) {
  var actual = u.toHash('0123456789')
  var expected = new Buffer([ 0x89, 0x67, 0x45, 0x23, 0x01 ])
  t.equal(actual.compare(expected), 0)
  t.end()
})

var storePath = 'data/' + process.pid + '.store'

test('createStore', function (t) {
  t.test('simple createStore', function (t) {
    var store = u.createStore({ path: storePath }, function (err) {
      t.error(err)
      store.close(t.end)
    })
  })

  t.test('error when createStore is called without a path', function (t) {
    t.throws(function () {
      u.createStore()
    })
    t.end()
  })

  t.end()
})

test('toCompactTarget', function (t) {
  var target = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex')
  t.equal(u.toCompactTarget(target), 0x2200ffff)

  target = new BN('ffff0000000000000000000000000000000000000000000000000000', 'hex')
  t.equal(u.toCompactTarget(target), 0x1d00ffff)

  target = new BN('ffff0000000000000000000000000000000000000000000000000001', 'hex')
  t.equal(u.toCompactTarget(target), 0x1d00ffff)

  target = new BN('7fff0000000000000000000000000000000000000000000000000000', 'hex')
  t.equal(u.toCompactTarget(target), 0x1c7fff00)

  target = new BN('0', 'hex')
  t.equal(u.toCompactTarget(target), 0x0)

  t.end()
})
