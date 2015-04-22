var buffertools = require('buffertools');

module.exports = {
  toHash: function(hex) {
    return buffertools.reverse(new Buffer(hex, 'hex'));
  },
  formatHash: function(hash) {
    if(hash instanceof Buffer) return hash;
    if(typeof hash === 'string') return new Buffer(hash, 'hex');
    throw new Error('Invalid hash format');
  }
};
