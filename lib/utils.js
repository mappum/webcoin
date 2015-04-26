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
    return levelup(opts.path, opts, cb)
  }
}
