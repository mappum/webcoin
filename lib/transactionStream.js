var Transform = require('stream').Transform
var util = require('util')
var Block = require('bitcore').Block

var TransactionStream = module.exports = function (blocks) {
  var self = this
  Transform.call(this, { objectMode: true })

  blocks.on('end', function () { self.push(null) })
  blocks.pipe(this)
}
util.inherits(TransactionStream, Transform)

TransactionStream.prototype._transform = function (block, enc, cb) {
  if (!(block instanceof Block)) {
    return cb(new Error('Input to TransactionStream must be a stream of blocks'))
  }

  var self = this
  block.transactions.forEach(function (tx) {
    self.push(tx)
  })
  cb(null)
}
