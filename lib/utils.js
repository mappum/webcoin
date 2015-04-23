var buffertools = require('buffertools');

module.exports = {
  toHash: function(hex) {
    return buffertools.reverse(new Buffer(hex, 'hex'));
  }
};
