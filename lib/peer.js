var util = require('util')
var p2p = require('bitcore-p2p')
var pkg = require('../package.json')

var Peer = module.exports = function (opts) {
  if (this instanceof Peer) {
    p2p.Peer.call(this, opts)
  } else {
    return new Peer(opts)
  }

  if (opts.getTip) this.getTip = opts.getTip

  var self = this
  this.on('ready', function (message) {
    self.connectTime = Date.now()
    self.socket.on('error', function (err) {
      self.emit('error', err)
    })

    if (self.filter) self._sendFilterLoad()
  })
  this.on('version', function (message) {
    self.services = message.services
  })

  this.remoteAddress = 'tcp://' + this.host + ':' + this.port
  this.filter = null
}
util.inherits(Peer, p2p.Peer)

Peer.STATUS = p2p.Peer.STATUS

Peer.prototype._sendVersion = function () {
  var message = this.messages.Version({ relay: this.relay })

  message.subversion = '/' + pkg.name + ':' + pkg.version + message.subversion
  if (process.browser) message.subversion += navigator.userAgent + '/'
  else message.subversion += process.title + ':' + process.versions.node + '/'

  if (this.getTip) {
    var tip = this.getTip()
    message.startHeight = tip.height
  }

  this.versionSent = true
  this.sendMessage(message)
}

Peer.prototype.getFilter = function () {
  return this.filter
}

Peer.prototype.setFilter = function (filter) {
  if (filter != null && !(filter instanceof p2p.BloomFilter)) {
    throw new Error('Filter must be an instance of bitcore-p2p.BloomFilter')
  }
  this.filter = filter
  if (this.status === Peer.STATUS.READY) {
    if (filter) this._sendFilterLoad()
    else this.sendFilterClear()
  }
}

Peer.prototype.addToFilter = function (data) {
  if (!this.filter) {
    // TODO: create a BloomFilter class that automatically sets its parameters as
    // elements are added
    this.setFilter(p2p.BloomFilter.create(1000, 0.1))
  }
  this.filter.insert(data)
  if (this.status === Peer.STATUS.READY) this._sendFilterAdd(data)
}

Peer.prototype._sendFilterLoad = function () {
  var message = this.messages.FilterLoad(this.filter)
  this.sendMessage(message)
}

Peer.prototype._sendFilterAdd = function (data) {
  var message = this.messages.FilterAdd(data)
  this.sendMessage(message)
}

Peer.prototype._sendFilterClear = function () {
  var message = this.messages.FilterClear()
  this.sendMessage(message)
}
