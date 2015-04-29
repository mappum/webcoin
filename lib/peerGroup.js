var EventEmitter = require('events').EventEmitter
var util = require('util')
var Networks = require('bitcore').Networks
var PeerhubClient = require('peerhub/client')
var p2p = require('bitcore-p2p')
var Builder = p2p.Messages.builder
var Peer = require('./peer.js')
var WebPeer = require('./webPeer.js')
var u = require('./utils.js')

var webSeeds = require('./constants.js').webSeeds

// HACK: suppress warnings from Buffer#get()
Buffer.prototype.get = function get (offset) {
  return this.readUInt8(offset)
}

var commands = Object.keys((new Builder()).commandsMap)

var PeerGroup = module.exports = function (opts) {
  opts = opts || {}
  this.network = Networks.get(opts.network) || Networks.defaultNetwork
  this.acceptTcp = opts.acceptTcp || false
  this.acceptWeb = opts.acceptWeb || false
  this.tcpCount = opts.tcpCount != null ? opts.tcpCount : 5
  this.webCount = opts.webCount != null ? opts.webCount : 5
  this.autoConnect = opts.autoConnect != null ? opts.autoConnect : true
  this.getTip = opts.getTip

  this.webSeeds = []

  this.connected = false
  this.peers = []
  this.peers.tcp = []
  this.peers.web = []
  this.messages = null

  this.filter = null

  this.pool = new p2p.Pool({ maxSize: this.tcpCount })
  this.pool.on('peerconnect', this._onTCPPeerConnect.bind(this))
}
util.inherits(PeerGroup, EventEmitter)

PeerGroup.prototype._error = function (err) {
  this.emit('error', err)
}

PeerGroup.prototype._onPeerConnect = function (peer) {
  var self = this
  peer.on('ready', function () {
    self._onPeerReady(peer)
    self.emit('peer', peer)
  })
  peer.on('error', function (err) {
    self._error(err)
  })
  peer.on('disconnect', function () {
    self._onPeerDisconnect(peer)
    self.emit('peerdisconnect', peer)
  })
  this.emit('peerconnect', peer)
}

PeerGroup.prototype._onPeerReady = function (peer) {
  var self = this
  this.peers.push(peer)
  if (peer instanceof WebPeer) this.peers.web.push(peer)
  else this.peers.tcp.push(peer)

  if (this.filter) peer.setFilter(this.filter)

  if (!this.messages) this.messages = peer.messages
  commands.forEach(function (key) {
    peer.on(key, function (message) {
      self.emit(key, peer, message)
    })
  })
}

PeerGroup.prototype._onPeerDisconnect = function (peer) {
  var isWeb = peer instanceof WebPeer

  u.remove(this.peers, peer)
  u.remove(isWeb ? this.peers.web : this.peers.tcp, peer)

  if (this.autoConnect && isWeb) {
    // TODO (we don't yet have a way of ensuring peers are unique)
  }
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
    if (self.numberConnected() >= (self.tcpCount + self.webCount) / 2) {
      self.removeListener('peerconnect', onPeerConnect)
      self.connected = true
      self.emit('connect')
    }
  })

  if (!process.browser) {
    // first check if a peer is running on the local machine
    this._connectToLocalhost(function (err, peer) {
      if (err || !peer) {
        // if we couldn't connect to the local peer, connect to DNS seed peers
        return self._connectToTCPPeers()
      }
      // if we eventually disconnect from local peer, connect to DNS seed peers
      peer.on('disconnect', self._connectToTCPPeers.bind(self))
    })
  }

  webSeeds.forEach(function (uri) {
    var client = new PeerhubClient(uri, function () {
      self.webSeeds.push(client)
      self.emit('seedconnect', client)
      self._connectToWebPeers()
      if (self.acceptWeb) self._acceptFromPeerhub(client)
    })
  })
}

PeerGroup.prototype._connectToLocalhost = function (cb) {
  var self = this
  if (process.browser) return cb(new Error('Not supported in the browser'))

  var localPeer = new Peer({ host: 'localhost', getTip: this.getTip })

  var couldNotConnect = function () {
    if (cb) return cb(new Error('Could not connect'))
  }
  localPeer.on('error', couldNotConnect)
  localPeer.on('connect', function () {
    self._onPeerConnect(localPeer)
  })
  localPeer.on('ready', function () {
    localPeer.removeListener('error', couldNotConnect)
    if (cb) return cb(null, localPeer)
  })

  localPeer.connect()
}

PeerGroup.prototype._connectToTCPPeers = function () {
  if (process.browser) throw new Error('Not supported in the browser')

  if (this.tcpCount <= 0) return
  this.pool.connect()
  if (this.acceptTcp) this.pool.listen()
}

PeerGroup.prototype._onTCPPeerConnect = function (peer) {
  peer.getTip = this.getTip
  this._onPeerConnect(new Peer(peer))
}

PeerGroup.prototype._connectToWebPeers = function () {
  var self = this
  var client = this.webSeeds[Math.floor(Math.random() * this.webSeeds.length)]
  client.discover(function (err, peerIds) {
    if (err) return console.error(err)

    peerIds = peerIds.slice(0, self.webCount - self.numberConnected())
    peerIds.forEach(function (id) {
      client.connect(id, function (err, peer) {
        if (err) return self._error(err)
        self._onWebPeerConnect(peer)
      })
    })
  })
}

PeerGroup.prototype._onWebPeerConnect = function (conn, incoming) {
  var peer = new WebPeer(conn, { incoming: !!incoming, getTip: this.getTip })
  peer.connect()
  this._onPeerConnect(peer)
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

PeerGroup.prototype.sendMessage = PeerGroup.prototype.broadcast = function (message) {
  this.peers.forEach(function (peer) {
    peer.sendMessage(message)
  })
}
