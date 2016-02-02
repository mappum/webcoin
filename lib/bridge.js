var dns = require('dns')
var net = require('net')
var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var Networks = require('bitcore-lib').Networks
var PeerhubClient = require('peerhub/client')
var webSeeds = require('./constants.js').webSeeds
var debug = require('debug')('webcoin:bridge')

var Bridge = module.exports = function (opts) {
  var self = this
  this.network = opts.network || Networks.defaultNetwork
  this.addresses = []
  this.webSeeds = []
  this.localPeer = opts.localPeer

  webSeeds.forEach(function (uri) {
    debug('bridge connecting to web seed', uri)
    var client = new PeerhubClient(uri, function () {
      debug('bridge connected to web seed', uri)
      self.webSeeds.push(client)
      self.emit('seedconnect', client)
      client.accept(self._onWebPeerConnect.bind(self))
    })
    client.on('error', function (err) { self._error(err) })
  })
}
util.inherits(Bridge, EventEmitter)

Bridge.prototype._error = function (err) {
  if (!err) return
  debug('bridge error', err)
  this.emit('error', err)
}

Bridge.prototype._onWebPeerConnect = function (id, peer) {
  debug('bridge connected to peer', id)
  this.emit('connection', peer, id)
  peer.on('error', function () { peer.destroy() })
  this.bridgePeer(peer)
}

Bridge.prototype.resolveAddresses = function (cb) {
  var self = this
  var seeds = this.network.dnsSeeds
  async.map(seeds, dns.resolve, function (err, res) {
    if (err) return cb(err)
    res.forEach(function (addrs) {
      self.addresses = self.addresses.concat(addrs)
    })
    cb(null, res)
  })
}

Bridge.prototype.randomAddress = function () {
  var i = Math.floor(this.addresses.length * Math.random())
  return this.addresses[i]
}

Bridge.prototype.bridgePeer = function (webPeer) {
  var self = this

  if (!this.localPeer && this.addresses.length === 0) {
    debug('no tcp connections to bridge')
    this.resolveAddresses(self._error)
    return
  }

  var address = this.localPeer ? 'localhost' : this.randomAddress()
  debug('bridge tcp peer connecting', this.network.port, address)
  var tcpPeer = net.connect(this.network.port, address, function () {
    debug('bridge tcp peer connected', self.network.port, address)
    tcpPeer.pipe(webPeer).pipe(tcpPeer)

    tcpPeer.on('end', function () { webPeer.destroy() })
    webPeer.on('close', function () { tcpPeer.destroy() })

    self.emit('bridge', webPeer, tcpPeer)
  })
  tcpPeer.on('error', function () {
    webPeer.destroy()
  })
}
