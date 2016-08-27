'use strict'

const EventEmitter = require('events')
const old = require('old')
const sublevel = require('sublevelup')
const Blockchain = require('blockchain-spv')
const { PeerGroup } = require('bitcoin-net')
const { HeaderStream } = require('blockchain-download')
const Filter = require('bitcoin-filter')
const pump = require('pump')
const assign = require('object-assign')

function reqd (name) {
  throw new Error(`Argument "${name}" is required`)
}

class Node extends EventEmitter {
  constructor (params = reqd('params'), db = reqd('db'), opts = {}) {
    super()
    this.db = sublevel(db)

    this.chain = Blockchain(params.blockchain,
      this.db.sublevel('chain'), opts.chainOpts)
    this.chain.on('error', this._error.bind(this))

    var peerGroupOpts = assign({
      getTip: () => this.chain.getTip
    }, opts.peerGroupOpts)
    this.peers = PeerGroup(params.net, peerGroupOpts)
    this.peers.on('error', this._error.bind(this))

    this.filter = Filter(this.peers, opts.filterOpts)
  }

  start () {
    // connect to peers
    this.peers.connect(() => {
      // download headers from peers and pipe into chain
      this.headers = HeaderStream(this.peers)
      this.headers.once('tip', () => {
        this.chain.once('headers', () => {
          this.emit('tip', this.chain.getTip())
        })
      })
      pump(
        this.chain.createLocatorStream(),
        this.headers,
        this.chain.createWriteStream(),
        this._error.bind(this)
      )
    })
    return this
  }

  _error (err) {
    if (!err) return
    this.emit('error', err)
  }
}

module.exports = old(Node)
