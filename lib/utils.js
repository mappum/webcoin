var buffertools = require('buffertools');

module.exports = {
  toHash: function(hex) {
    return buffertools.reverse(new Buffer(hex, 'hex'));
  },
  formatHash: function(hash) {
    if(Buffer.isBuffer(hash)) return buffertools.reverse(hash).toString('hex');
    if(typeof hash === 'string') return hash;
    throw new Error('Invalid hash format');
  }
};
