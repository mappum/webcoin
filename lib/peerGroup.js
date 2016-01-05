var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var bitcore = require('bitcore-lib')
var Networks = bitcore.Networks
var Transaction = bitcore.Transaction
var PeerhubClient = require('peerhub/client')
var p2p = require('bitcore-p2p')
var Builder = p2p.Messages.builder
var Inventory = p2p.Inventory
var Peer = require('./peer.js')
var WebPeer = require('./webPeer.js')
var u = require('./utils.js')

var webSeeds = require('./constants.js').webSeeds

var supportsWebRTC = false
if (process.browser) {
  var RTCPC = window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCPeerConnection
  supportsWebRTC = !!RTCPC
} else {
  try {
    require('wrtc')
    supportsWebRTC = true
  } catch (e) {}
}

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

  this.connecting = false
  this.connected = false
  this.disconnecting = false
  this.connectedTCP = false
  this.connectedWeb = false

  this.peers = []
  this.peers.tcp = []
  this.peers.web = []
  this.messages = null

  this.filter = opts.filter || null
  this.inventory = {}

  this.pool = new p2p.Pool({ maxSize: this.tcpCount, network: this.network })
  this.pool.on('peerconnect', this._onTCPPeerConnect.bind(this))

  this.setMaxListeners(100)
}
util.inherits(PeerGroup, EventEmitter)

PeerGroup.prototype._error = function (err) {
  this.emit('error', err)
}

PeerGroup.prototype._onPeerConnect = function (peer) {
  var self = this

  if (!(peer instanceof Peer)) {
    peer = new Peer(peer)
  }

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
      self.emit(key, message, peer)
    })
  })

  peer.on('getdata', function (message) {
    message.inventory.forEach(function (inv) {
      var hash = inv.hash.toString('base64')
      var item = self.inventory[hash]
      if (!item) return
      // TODO: handle types other than transactions
      var txMessage = peer.messages.Transaction(item.value)
      peer.sendMessage(txMessage)
    })
  })

  var invMessage = peer.messages.Inventory(this.getInventory())
  peer.sendMessage(invMessage)
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

PeerGroup.prototype.randomPeer = function () {
  // prefers TCP peers to WebRTC peers
  var peers = this.peers
  if (peers.tcp.length) peers = peers.tcp
  return peers[Math.floor(Math.random() * peers.length)]
}

PeerGroup.prototype.connect = function (opts, cb) {
  var self = this

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  if (cb) {
    this.once('ready', function () { cb(null) })
  }

  this.connecting = true

  var tasks = []

  if (!process.browser) {
    tasks.push(function (cb) {
      // first check if a peer is running on the local machine
      self._connectToLocalhost(function (err, peer) {
        if (err || !peer) {
          // if we couldn't connect to the local peer, connect to DNS seed peers
          return self._connectToTCPPeers(cb)
        }
        // if we eventually disconnect from local peer, connect to DNS seed peers
        peer.on('disconnect', self._connectToTCPPeers.bind(self))
        cb(null)
      })
    })
  }

  if (supportsWebRTC) {
    tasks.push(function (cb) {
      async.each(webSeeds, function (uri, cb) {
        var client = new PeerhubClient(uri, function () {
          self.webSeeds.push(client)
          self.emit('seedconnect', client)
          self._connectToWebPeers()
          if (self.acceptWeb) self._acceptFromPeerhub(client)
          cb(null)
        })
      }, cb)
    })
  }

  async.parallel(tasks, function (err) {
    if (err) return (cb || self._error)(err)
    self.connecting = false
    self.emit('ready')
  })
}

PeerGroup.prototype._connectToLocalhost = function (cb) {
  var self = this
  if (process.browser) return cb(new Error('Not supported in the browser'))

  var localPeer = new Peer({
    host: 'localhost',
    port: this.network.port,
    getTip: this.getTip
  })

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

PeerGroup.prototype._connectToTCPPeers = function (cb) {
  if (process.browser) throw new Error('Not supported in the browser')
  if (!cb) cb = function () {}

  var self = this
  if (this.tcpCount <= 0) return cb(null)
  // FIXME: temporary hack to fix intermittent connection problems:
  // (reconnect pool every 5 seconds if no peers connect)
  var interval = setInterval(function () {
    self.pool.connect()
  }, 5000)
  function onPeerConnect () {
    self.pool.removeListener('peerconnect', onPeerConnect)
    clearInterval(interval)
    cb(null)
  }
  if (!this.connected) this.pool.on('peerconnect', onPeerConnect)
  this.pool.connect()
  if (this.acceptTcp) this.pool.listen()
}

PeerGroup.prototype._onTCPPeerConnect = function (peer) {
  if (this.disconnecting) return
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
  if (this.disconnecting) return
  var peer = new WebPeer(conn, { incoming: !!incoming, getTip: this.getTip })
  peer.connect()
  this._onPeerConnect(peer)
  this.emit('webpeer', peer)
}

PeerGroup.prototype.acceptWebPeers = function () {
  if (!supportsWebRTC) throw new Error('WebRTC is not supported')
  this.webSeeds.forEach(this._acceptFromPeerhub.bind(this))
  this.acceptWeb = true
}

PeerGroup.prototype._acceptFromPeerhub = function (client) {
  var self = this
  client.accept(function (id, peer) { self._onWebPeerConnect(peer, true) })
}

PeerGroup.prototype.disconnect = function (cb) {
  var self = this

  this.disconnecting = true

  if (this.connecting) {
    return this.on('ready', function () {
      self.disconnect(cb)
    })
  }

  self.peers.forEach(function (peer) {
    peer.disconnect()
  })
  self.webSeeds.forEach(function (client) {
    client.disconnect()
  })

  if (this.pool) this.pool.disconnect()
  self.emit('disconnect')
  if (cb) cb(null)
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

PeerGroup.prototype.addToInventory = function (item, data) {
  // TODO: support inventory types other than transactions
  if (!(item instanceof Transaction)) {
    throw new Error('Argument must be an instance of bitcore.Transaction')
  }
  var hash = u.toHash(item.hash).toString('base64')
  var inv = new Inventory({
    type: Inventory.TYPE.TX,
    hash: u.toHash(item.hash)
  })
  this.inventory[hash] = {
    inv: inv,
    value: item
  }
  this.sendInventory(inv)
}

PeerGroup.prototype.getInventory = function () {
  var output = []
  for (var k in this.inventory) {
    output.push(this.inventory[k].inv)
  }
  return output
}

PeerGroup.prototype.sendInventory = function (item) {
  if (this.peers.length === 0) return
  var inventory = item ? [item] : this.getInventory()
  var message = this.messages.Inventory(inventory)
  this.sendMessage(message)
}

PeerGroup.prototype.broadcastTransaction = function (tx, cb) {
  this.addToInventory(tx)
  // TODO: remove tx from inventory after it has been confirmed
  // TODO: send relevant 'reject' message back as error to cb
  if (cb) cb(null)
}
