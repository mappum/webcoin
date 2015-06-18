var Networks = require('bitcore').Networks
var Messages = require('bitcore-p2p').Messages

var alpha = Networks.add({
  name: 'alpha',
  alias: 'alpha',
  pubkeyhash: 111,
  privatekey: 239,
  scripthash: 196,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  networkMagic: 0xeea11ffa,
  port: 4242,
  dnsSeeds: [
    'alpha-seed.bluematt.me'
  ]
})
alpha.constructors = {
  BlockHeader: require('./privateBlockHeader.js'),
  Block: require('./privateBlock.js')
}
alpha.messages = new Messages({
  network: alpha,
  BlockHeader: alpha.constructors.BlockHeader,
  Block: alpha.constructors.Block
})

module.exports = {
  alpha: alpha
}
