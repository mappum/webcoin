var bitcore = require('bitcore')
var u = require('./utils.js')

module.exports = {
  genesisHeaders: {
    livenet: new bitcore.BlockHeader({
      version: 1,
      prevHash: u.toHash('0000000000000000000000000000000000000000000000000000000000000000'),
      merkleRoot: u.toHash('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'),
      time: 1231006505,
      bits: 0x1d00ffff,
      nonce: 2083236893
    }),
    testnet: new bitcore.BlockHeader({
      version: 1,
      prevHash: u.toHash('0000000000000000000000000000000000000000000000000000000000000000'),
      merkleRoot: u.toHash('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'),
      time: 1296688602,
      bits: 0x1d00ffff,
      nonce: 414098458
    })
  },

  webSeeds: [
    '104.236.185.38:8192'
  ]
}
