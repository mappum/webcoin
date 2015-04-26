var EventEmitter = require('events').EventEmitter
var util = require('util')
var Networks = require('bitcore').Networks
var PeerhubClient = require('peerhub/client')
var Peer = require('./peer.js')
var WebPeer = require('./webPeer.js')
var p2p = require('bitcore-p2p')

var webSeeds = require('./constants.js').webSeeds

// HACK: suppress warnings from Buffer#get()
Buffer.prototype.get = function get (offset) {
  return this.readUInt8(offset)
}

var PeerGroup = module.exports = function (opts) {
  opts = opts || {}
  this.network = Networks.get(opts.network) || Networks.defaultNetwork
  this.acceptTcp = opts.acceptTcp || false
  this.acceptWeb = opts.acceptWeb || false
  this.maxSize = opts.maxSize || 10
  this.verbose = opts.verbose || false
  this.getTip = opts.getTip

  this.webSeeds = []

  this.connected = false
  this.peers = []
  this.filter = null

  this.on('peerconnect', this._onPeerConnect)
}
util.inherits(PeerGroup, EventEmitter)

PeerGroup.prototype._onPeerConnect = function (peer) {
  var self = this
  this.peers.push(peer)

  peer.on('disconnect', function () {
    var index = self.peers.indexOf(peer)
    self.peers.splice(index, 1)
  })

  if (this.filter) peer.setFilter(this.filter)
}

PeerGroup.prototype.numberConnected = function () {
  return this.peers.length
}

PeerGroup.prototype.connect = function (opts, cb) {
  var self = this

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  if (cb) this.once('connect', cb)

  this.on('peerconnect', function onPeerConnect () {
    if (self.numberConnected() >= Math.floor(self.maxSize / 2)) {
      self.removeListener('peerconnect', onPeerConnect)
      this.connected = true
      self.emit('connect')
    }
  })

  if (!process.browser) {
    // first check if a peer is running on the local machine
    this._connectToLocalhost(function (err, peer) {
      if (err) {
        // if we couldn't connect to the local peer, connect to DNS seed peers
        if (self.verbose) console.log('Could not connect to local peer:', err)
        return self._connectToDNSPeers(function (err, peer, pool) {
          if (err) return console.error(err)
          if (!self.pool) self.pool = pool
          self.emit('peerconnect', peer)
        })
      }

      self.emit('peerconnect', peer)
    })
  }

  webSeeds.forEach(function (uri) {
    var client = new PeerhubClient(uri, function () {
      if (self.verbose) console.log('Connected to web seed:', uri)
      self.webSeeds.push(client)

      self._connectToWebPeers(function (err, peer) {
        if (err) return console.error(err)
        self._onWebPeerConnect(peer)
      })

      if (self.acceptWeb) self._acceptFromPeerhub(client)
    })
  })
}

PeerGroup.prototype._connectToLocalhost = function (cb) {
  if (process.browser) return cb(new Error('Not supported in the browser'))

  var localPeer = new Peer({ host: 'localhost', getTip: this.getTip })

  var couldNotConnect = function () {
    if (cb) return cb(new Error('Could not connect'))
  }
  localPeer.on('error', couldNotConnect)
  localPeer.on('ready', function () {
    localPeer.removeListener('error', couldNotConnect)
    if (cb) return cb(null, localPeer)
  })

  localPeer.connect()
}

PeerGroup.prototype._connectToDNSPeers = function (opts, cb) {
  var self = this
  if (process.browser) return cb(new Error('Not supported in the browser'))

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  if (opts.maxSize == null) opts.maxSize = Math.floor(this.maxSize / 2)

  this.pool = this.pool || new p2p.Pool(opts)
  var callbackCount = 0
  var onConnect = function (peer) {
    peer.getTip = self.getTip
    peer = new Peer(peer)
    peer.on('ready', function () {
      callbackCount++
      if (callbackCount >= opts.maxSize) {
        self.pool.removeListener('peerconnect', onConnect)
      }
      cb(null, peer, self.pool)
    })
  }
  this.pool.on('peerconnect', onConnect)
  this.pool.connect()

  if (this.acceptTcp) this.pool.listen()
}

PeerGroup.prototype._connectToWebPeers = function (opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  var client = this.webSeeds[Math.floor(Math.random() * this.webSeeds.length)]
  client.discover(function (err, peerIds) {
    if (err) return console.error(err)

    peerIds = peerIds.slice(0, self.maxSize - self.numberConnected())
    peerIds.forEach(function (id) {
      client.connect(id, cb)
    })
  })
}

PeerGroup.prototype._onWebPeerConnect = function (conn, incoming) {
  var self = this
  var peer = new WebPeer(conn, { incoming: !!incoming, getTip: this.getTip })
  peer.on('ready', function () {
    self.emit('peerconnect', peer)
  })
  peer.connect()
}

PeerGroup.prototype.acceptWebPeers = function () {
  this.webSeeds.forEach(this._acceptFromPeerhub.bind(this))
  this.acceptWeb = true
}

PeerGroup.prototype._acceptFromPeerhub = function (client) {
  var self = this
  client.accept(function (id, peer) { self._onWebPeerConnect(peer, true) })
}

PeerGroup.prototype.disconnect = function () {
  if (this.pool) this.pool.disconnect()
  this.peers.forEach(function (peer) {
    peer.disconnect()
  })
  this.webSeeds.forEach(function (client) {
    client.disconnect()
  })
  this.emit('disconnect')
}

PeerGroup.prototype.setFilter = function (filter) {
  this.peers.forEach(function (peer) {
    peer.setFilter(filter)
  })
  this.filter = filter
}

PeerGroup.prototype.addToFilter = function (data) {
  this.filter.insert(data)
  this.peers.forEach(function (peer) {
    peer.addToFilter(data)
  })
}
