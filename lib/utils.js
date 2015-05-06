var buffertools = require('buffertools')
var levelup = require('levelup')
var mkdirp = require('mkdirp')

module.exports = {
  toHash: function (hex) {
    return buffertools.reverse(new Buffer(hex, 'hex'))
  },

  createStore: function (opts, cb) {
    opts = opts || {}
    if (opts.path && !process.browser) mkdirp.sync(opts.path)
    if (!opts.db) {
      opts.db = process.browser ? require('level-js') : require('leveldown')
    }
    opts.keyEncoding = opts.keyEncoding || 'utf8'
    opts.valueEncoding = opts.valueEncoding || 'json'
    return levelup(opts.path, opts, cb)
  },

  remove: function (array, value) {
    var index = array.indexOf(value)
    if (index === -1) return
    array.splice(index, 1)
  },

  toCompactTarget: function (target) {
    var exponent = Math.ceil(target.bitLength() / 8)
    var targetString = target.toString(16)
    if (targetString.length % 2 === 1) targetString = '0' + targetString
    var mantissa = Number.parseInt(targetString.substr(0, 6), 16)
    if (mantissa & 0x800000) {
      mantissa >>= 8
      exponent++
    }
    return (exponent << 24) | mantissa
  }
}
