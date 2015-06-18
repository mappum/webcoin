var Networks = require('bitcore').Networks
var Messages = require('bitcore-p2p').Messages
var u = require('./utils.js')

var mainnet = Networks.get('mainnet')
mainnet.verify = function (chain, block, prev, cb) {
  // make sure difficulty didn't change at the wrong time
  if (!chain.shouldRetarget(block.height) &&
  block.header.bits !== prev.header.bits) {
    return cb(new Error('Unexpected difficulty change'))
  }

  // make sure the proper amount of work was done
  if (!block.header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'))
  }

  // TODO: other checks (timestamp, version)

  // verify difficulty is correct
  if (chain.shouldRetarget(block.height) &&
  // don't verify retarget if it requires checking before the checkpoint
  !(chain.checkpoint && block.height - chain.checkpoint.height < chain.interval)) {
    return chain.calculateTarget(block, function (err, target) {
      if (err) return cb(err, block)

      var expected = u.toCompactTarget(target)
      if (expected !== block.header.bits) {
        return cb(new Error('Bits in block (' + block.header.bits.toString(16) +
          ')' + ' is different than expected (' + expected.toString(16) + ')'))
      }
      cb(null)
    })
  }

  cb(null)
}

var testnet = Networks.get('testnet')
testnet.verify = function (chain, block, prev, cb) {
  // TODO: verify difficulty is correct

  // make sure the proper amount of work was done
  if (!block.header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'))
  }

  cb(null)
}

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
alpha.challenge = new Buffer('5521027d5d62861df77fc9a37dbe901a579d686d1423be5f56d6fc50bb9de3480871d12103b41ea6ba73b94c901fdd43e782aaf70016cc124b72a086e77f6e9f4f942ca9bb2102be643c3350bade7c96f6f28d1750af2ef507bc1f08dd38f82749214ab90d903721021df31471281d4478df85bfce08a10aab82601dca949a79950f8ddf7002bd915a210320ea4fcf77b63e89094e681a5bd50355900bf961c10c9c82876cb3238979c0ed21021c4c92c8380659eb567b497b936b274424662909e1ffebc603672ed8433f4aa121027841250cfadc06c603da8bc58f6cd91e62f369826c8718eb6bd114601dd0c5ac57ae', 'hex')
alpha.constructors = {
  BlockHeader: require('./privateBlockHeader.js'),
  Block: require('./privateBlock.js')
}
alpha.messages = new Messages({
  network: alpha,
  BlockHeader: alpha.constructors.BlockHeader,
  Block: alpha.constructors.Block
})
alpha.verify = function (chain, block, prev, cb) {
  // make sure the challenge is valid
  if (block.header.challenge.toBuffer().compare(this.challenge) !== 0) {
    return cb(new Error('Invalid challenge: ' +
      'got "' + block.header.challenge.toBuffer().toString('hex') + '", ' +
      'expected "' + this.challenge.toString('hex') + '"'))
  }

  // make sure the proper amount of work was done
  if (!block.header.validSolution()) {
    return cb(new Error('Invalid solution'))
  }

  cb(null)
}

module.exports = {
  alpha: alpha
}
