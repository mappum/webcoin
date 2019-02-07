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

// TODO: get this from somewhere else
const { getTxHash } = require('bitcoin-net/src/utils.js')

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
    this.scan = this.handleErrors(this.scan)
    this.getUtxos = this.handleErrors(this.getUtxos)

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

    this.scanning = false
    this.scanTxs = []
  }

  start () {
    // connect to peers
    this.peers.connect(() => {
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

    // strings are addresses, convert to script item
    if (typeof item === 'string') {
      item = addressToItem(item)
    }

    this.filterItems.push(item)
    this._filter.add(item)
  }

  // TODO: support timestamp ranges
  async scan (range, onTransaction) {
    if (this.scanning) {
      throw Error('Already scanning')
    }
    this.scanning = true
    try {
      await this.ready()

      // TODO: allow ascending scan which can happen while headers are syncing

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

      let txSet = new Set()

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
          let existed = !!tx
          if (tx == null) {
            tx = await new Promise((resolve) => {
              this.peers.once(`tx:${hash.toString('base64')}`, resolve)
            })
          }
          txSet.add(tx)
          onTransaction(tx)
        }
      }

      // re-emit unconfirmed txs
      for (let tx of this.scanTxs) {
        if (!txSet.has(tx)) {
          this.onTransaction(tx)
        }
      }
      this.scanTxs = []
    } finally {
      this.scanning = false
    }
  }

  async getUtxos (opts = {}) {
    await this.ready()

    return new Promise((resolve, reject) => {
      let scanRange = opts.scanRange || 50
      let limit = opts.limit || 1

      let spent = new Set()
      let utxos = []

      let done = (err) => {
        this.removeListener('unconfirmed-tx', onTx)
        if (err != null) {
          reject(err)
        } else {
          resolve(utxos)
        }
      }

      let onTx = (tx) => {
        let txid = getTxHash(tx)
        let txidBase64 = txid.toString('base64')

        for (let input of tx.ins) {
          if (!this.matchesFilter(input.script)) continue
          spent.add(`${input.hash.toString('base64')}:${input.index}`)
        }

        let vout = -1
        for (let output of tx.outs) {
          vout += 1
          if (!this.matchesFilter(output.script)) continue
          if (spent.has(`${txidBase64}:${vout}`)) continue
          utxos.push({ tx, txid, vout, ...output })
          if (utxos.length >= limit) done()
        }
      }

      this.on('unconfirmed-tx', onTx)

      // XXX: wait for peers to send mempool txs before scanning
      this.peers.send('mempool')
      setTimeout(() => {
        if (utxos.length >= limit) return
        this.scan(scanRange, onTx)
          .catch(done)
      }, 5000)
    })
  }

  onTransaction (tx) {
    // while scanning, put all received txs into a queue
    // so we can figure out which ones are unconfirmed and
    // which ones are from the scan results. unconfirmed txs
    // will be re-emitted after the scan is done
    if (this.scanning) {
      this.scanTxs.push(tx)
      return
    }

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

  handleErrors (func) {
    func = func.bind(this)
    return (...args) => {
      return func(...args).catch(this.error)
    }
  }

  async ready () {
    if (this._filter == null) {
      throw Error('No filter items set')
    }

    // ensure filter is ready
    await new Promise((resolve) => {
      this._filter.onceReady(resolve)
    })

    // wait for chain to be synced to tip
    if (!this.atTip) {
      await new Promise((resolve) => this.once('tip', resolve))
    }
  }

  matchesFilter (script) {
    for (let item of this.filterItems) {
      if (script.includes(item)) return true
    }
    return false
  }
}

function addressToItem (address) {
  try {
    return bitcoin.address.fromBase58Check(address).hash
  } catch (err) {}

  try {
    return bitcoin.address.fromBech32(address).data
  } catch (err) {}

  throw Error('Unknown address type')
}

module.exports = old(Node)
