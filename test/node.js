var test = require('tape')
var Node = require('../')
var params = require('webcoin-bitcoin')
var level = require('levelup')
var memdown = require('memdown')

test('create node', function (t) {
  var db = level({ db: memdown })
  var node = Node(params, db)
  t.ok(node instanceof Node, 'created Node instance')
  t.end()
})
