'use strict'

const EventEmitter = require('events')
const old = require('old')
const Blockchain = require('blockchain-spv')
const { PeerGroup } = require('bitcoin-net')
const download = require('blockchain-download')
const Filter = require('bitcoin-filter')
const Inventory = require('bitcoin-inventory')
const bitcoin = require('bitcoinjs-lib')
const merkle = require('bitcoin-merkle-proof')

const params = {
  bitcoin: require('webcoin-bitcoin'),
  testnet: require('webcoin-bitcoin-testnet')
}

class Node extends EventEmitter {
  constructor (opts = {}) {
    super()

    this.opts = opts

    let network = opts.network || 'bitcoin'

    // TODO: support regtest
    this.bitcoinJsNetwork = bitcoin.networks[network]
    this.params = params[network]
    if (!this.bitcoinJsNetwork || !this.params) {
      throw Error(`Unknown network "${network}"`)
    }

    this.error = this.error.bind(this)
    let scan = this.scan.bind(this)
    this.scan = (...args) => {
      return scan(...args).catch(this.error)
    }

    // TODO: chain state persistence
    this.chain = Blockchain({
      indexed: true,
      start: this.params.blockchain.checkpoints.slice(-1)[0],
      allowMinDifficultyBlocks:
        network === 'testnet' || network === 'regtest',
      ...opts.chainOpts
    })
    this.chain.on('error', this.error)

    this.peers = PeerGroup(this.params.net, opts.netOpts)
    this.peers.on('error', this.error)

    this.filterItems = []
    this._filter = null

    this.inventory = Inventory(this.peers)
    this.inventory.on('error', this.error)
    this.inventory.on('tx', this.onTransaction.bind(this))

    this.atTip = false
    this.once('tip', () => this.atTip = true)
  }

  start () {
    // connect to peers
    this.peers.connect(async () => {
      // download headers, verify, and add to chain
      download(this.chain, this.peers)
        .then(() => {
          this.emit('tip')
          // TODO: listen for new blocks after tip
        })
        .catch(this.error())
    })
  }

  filter (item) {
    if (this._filter == null) {
      this._filter = Filter(this.peers, this.opts.filterOpts)
    }
    this.filterItems.push(item)
    this._filter.add(item)
  }

  // TODO: support timestamp ranges
  async scan (range, onTransaction) {
    if (this._filter == null) {
      throw Error('Cannot call scan until filter items are set')
    }

    // ensure filter is ready
    await new Promise((resolve) => {
      this._filter.onceReady(resolve)
    })

    // wait for chain to be synced to tip
    // TODO: allow ascending scan which can happen while headers are syncing
    if (!this.atTip) {
      await new Promise((resolve) => this.once('tip', resolve))
    }

    // TODO: break up request into batches
    let height = this.chain.height()
    let blockHashes = []
    for (let i = 0; i < range; i++) {
      let header = this.chain.getByHeight(height - i)
      let hash = Blockchain.getHash(header)
      blockHashes.push(hash)
    }

    let blocks = await new Promise((resolve, reject) => {
      this.peers.getBlocks(blockHashes, { filtered: true }, (err, blocks) => {
        if (err != null) return reject(err)
        resolve(blocks)
      })
    })

    // verify proofs for blocks with txs that matched the filter
    let nonEmptyBlocks = blocks.filter((block) => !block.flags.equals(Buffer.from([ 0 ])))
    for (let merkleBlock of nonEmptyBlocks) {
      let hash = Blockchain.getHash(merkleBlock.header)
      let header = this.chain.getByHash(hash)
      if (header.height > height || (height - header.height) > range) {
        // block out of scan range (TODO: should this error?)
        continue
      }
      let matchedHashes = merkle.verify({
        merkleRoot: header.merkleRoot,
        hashes: merkleBlock.hashes,
        flags: merkleBlock.flags,
        numTransactions: merkleBlock.numTransactions
      })

      // get or wait for txs included in the proof
      // we use reverse tx order since the scan is already in reverse block order
      for (let hash of matchedHashes.reverse()) {
        let tx = this.inventory.get(hash)
        if (tx == null) {
          tx = await new Promise((resolve) => {
            this.peers.once(`tx:${hash.toString('base64')}`, resolve)
          })
        }
        onTransaction(tx)
      }
    }
  }

  onTransaction (tx) {
    // TODO: filter out false positives
    this.emit('unconfirmed-tx', tx)
  }

  close () {
     this.peers.close()
   }

  error (err) {
    if (err == null) return
    this.close()
    this.emit('error', err)
  }
}

module.exports = old(Node)
