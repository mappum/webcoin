'use strict'

const EventEmitter = require('events')
const old = require('old')
const sublevel = require('sublevelup')
const Blockchain = require('blockchain-spv')
const { PeerGroup } = require('bitcoin-net')
const { HeaderStream, BlockStream } = require('blockchain-download')
const Filter = require('bitcoin-filter')
const Inventory = require('bitcoin-inventory')
const pump = require('pump')
const assign = require('object-assign')

function reqd (name) {
  throw new Error(`Argument "${name}" is required`)
}

class Node extends EventEmitter {
  constructor (params = reqd('params'), db = reqd('db'), opts = {}) {
    super()
    this.db = sublevel(db)

    this.params = params

    this.chain = Blockchain(params.blockchain,
      this.db.sublevel('chain'), opts.chainOpts)
    this.chain.on('error', this._error.bind(this))

    var peerGroupOpts = assign({
      getTip: () => this.chain.getTip()
    }, opts.peerGroupOpts)
    var wrtc = opts.wrtc
    this.peers = PeerGroup(params.net, assign({ wrtc }, peerGroupOpts))
    this.peers.on('error', this._error.bind(this))

    this.filter = Filter(this.peers, opts.filterOpts)
    this.inventory = Inventory(this.peers)
  }

  start () {
    // connect to peers
    this.peers.connect(() => {
      // wait for filter to be ready
      this.filter.onceReady(() => {
        // download headers from peers and pipe into chain
        this.headers = HeaderStream(this.peers)
        this.headers.once('tip', () => {
          var emit = () => this.emit('synced', this.chain.getTip())
          if (!this.headers.lastHash) return emit()
          this.chain.once('headers', emit)
        })
        pump(
          this.chain.createLocatorStream(),
          this.headers,
          this.chain.createWriteStream(),
          this._error.bind(this)
        )
      })
    })
    return this
  }

  streamBlocks (from, onBlock) {
    if (typeof from === 'function') {
      onBlock = from
      from = null
    }
    this.chain.onceReady(() => {
      let blocks = BlockStream(this.peers, {
        inventory: this.inventory,
        filtered: true
      })
      blocks.on('data', onBlock)
      blocks.on('error', this._error)
      this.chain.createReadStream({ from }).pipe(blocks)
    })
    return this
  }

  _error (err) {
    if (!err) return
    this.emit('error', err)
  }
}

module.exports = old(Node)
