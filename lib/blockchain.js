var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var bitcore = require('bitcore')
var BN = bitcore.crypto.BN
var genesis = require('./constants.js').genesisHeaders
var BlockStore = require('./blockStore.js')
var u = require('./utils.js')

if (process.browser) {
  require('setimmediate')
}

function noop () {}

var Blockchain = module.exports = function (opts) {
  opts = opts || {}
  if (!opts.peerGroup) throw new Error('"peerGroup" option is required for Blockchain')
  this.peerGroup = opts.peerGroup
  this.network = bitcore.Networks.get(opts.network) || bitcore.Networks.defaultNetwork
  this.store = opts.store || new BlockStore({ path: opts.path })

  var genesisHeader = genesis[this.network.name]
  this.tip = {
    height: 0,
    hash: u.toHash(genesisHeader.hash),
    header: genesisHeader
  }
  this.downloadPeer = null
  this.syncing = false
  this.initialized = false
  this.syncHeight = 0

  this.interval = 2016
  this.targetSpacing = 10 * 60
  this.targetTimespan = this.interval * this.targetSpacing
  this.maxTarget = new BN('ffff0000000000000000000000000000000000000000000000000000', 'hex')

  this._onHeaders = this._onHeaders.bind(this)
  this._onDownloadPeerDisconnect = this._onDownloadPeerDisconnect.bind(this)
}
util.inherits(Blockchain, EventEmitter)

Blockchain.prototype.sync = function (opts, cb) {
  var self = this
  if (this.syncing) return cb(null)
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  if (cb) this.once('synced', cb)

  this.syncing = true
  if (opts.to) this.syncHeight = opts.to

  var syncDone = function () {
    var done = false
    if (self.syncHeight) {
      done = self.tip.height >= self.syncHeight
    } else {
      done = self.downloadPeer && self.tip.height >= self.downloadPeer
    }
    if (done) {
      self.removeListener('block', syncDone)
      self.removeListener('sync', syncDone)
      self.removeListener('syncing', syncDone)
      self.syncing = false
      self._setDownloadPeer(null)
      self.emit('synced', self.tip)
    }
  }
  this.on('block', syncDone)
  this.on('sync', syncDone)
  this.on('syncing', syncDone)

  var startDownload = function (err) {
    if (err) {
      err = new Error('Error initializing blockchain: ' + err)
      if (cb) return cb(err)
      else self.emit('error', err)
    }
    if (!self.downloadPeer) self._findDownloadPeer(self._getHeaders.bind(self))
    else self._getHeaders()
  }
  if (!this.initialized) this._initialize(startDownload)
  else startDownload(null)
}

Blockchain.prototype.getTip = function () {
  return this.tip
}

Blockchain.prototype._error = function (err) {
  this.emit('error', err)
}

Blockchain.prototype._initialize = function (cb) {
  cb = cb || noop

  if (this.initialized) return cb(null)

  var self = this
  this.store.getTip(function (err, tip) {
    self.initialized = true
    if (err && err.name === 'NotFoundError') return cb(null)
    if (err) return cb(err)
    self.tip = tip
    cb(null, tip)
  })
}

Blockchain.prototype._findDownloadPeer = function (cb) {
  var self = this
  cb = cb || noop

  if (this.peerGroup.peers.length === 0) {
    this.peerGroup.once('peerconnect', function () {
      self._findDownloadPeer(cb)
    })
    return
  }

  var peer = this.peerGroup.peers[Math.floor(Math.random() * this.peerGroup.peers.length)]
  this._setDownloadPeer(peer)
  return cb(null, peer)
}

Blockchain.prototype._setDownloadPeer = function (peer) {
  if (this.downloadPeer) {
    this.downloadPeer.removeListener('headers', this._onHeaders)
    this.downloadPeer.removeListener('disconnect', this._onDownloadPeerDisconnect)
  }

  this.downloadPeer = peer
  if (peer) {
    peer.on('headers', this._onHeaders)
    peer.on('disconnect', this._onDownloadPeerDisconnect)
    this.emit('syncing', peer)
  }
}

Blockchain.prototype._getHeaders = function (opts) {
  var self = this
  if (!this.downloadPeer) throw new Error('No download peer set')
  opts = opts || {}
  this._getLocator(opts.from || this.tip.hash, function (err, locator) {
    if (err) throw err
    var message = self.downloadPeer.messages.GetHeaders({
      starts: locator
    })
    self.downloadPeer.sendMessage(message)
  })
}

Blockchain.prototype._onHeaders = function (message) {
  var self = this
  if (!message.headers) return self._error(new Error('No headers in "headers" message from download peer'))
  if (message.headers.length === 0) return
  this._processHeaders(message.headers, function (err, last) {
    if (err) return self._error(new Error('Peer sent invalid headers:', err, last))
    self.emit('sync', last)
    if (self.syncing) self._getHeaders()
  })
}

Blockchain.prototype._onDownloadPeerDisconnect = function () {
  console.log('Download peer disconnected')
  this.downloadPeer = null
  this._findDownloadPeer()
}

Blockchain.prototype._getLocator = function (from, cb) {
  // TODO: support specifying locator by timestamp and by height
  // TODO: include some previous blocks in case our tip is on a fork
  return cb(null, [ from ])
}

Blockchain.prototype._get = function (hash, cb) {
  if (hash.compare(this.tip.hash) === 0) return cb(null, this.tip)

  this.store.get(hash, function (err, block) {
    if (err) return cb(err)
    cb(null, block)
  })
}

Blockchain.prototype._processHeaders = function (headers, cb) {
  var self = this

  var fromTip = headers[0].prevHash.compare(self.tip.hash) === 0
  var previousHeight = this.tip.height

  this._get(headers[0].prevHash, function (err, start) {
    if (err && err.name === 'NotFoundError') return cb(new Error('Block does not connect to chain'))
    if (err) return cb(err)

    if (self.syncHeight && start.height + headers.length > self.syncHeight) {
      headers = headers.slice(0, start.height + headers.length - self.syncHeight)
    }

    async.reduce(headers, start, self._processHeader.bind(self), function (err, last) {
      var reorg = !fromTip && last.height > previousHeight
      var done = function (err) {
        if (err) return cb(err, last)
        if (reorg) self.emit('reorg', last)
        cb(null, last)
      }

      if (reorg) {
        var reorgSize = start.height - previousHeight
        var toChange = headers.slice(0, reorgSize + 1)
        var height = start.height + reorgSize + 1
        async.reduceRight(toChange, headers[reorgSize + 1], function (nextHeader, header, cb) {
          var next = { height: height + 1, header: nextHeader }
          var current = { height: height, header: header }
          height--
          self.store.put(next, { best: true, prev: current }, function (err) {
            if (err) return cb(err)
            cb(null, current)
          })
        }, done)
        return
      }
      done(err, last)
    })
  })
}

Blockchain.prototype._processHeader = function (prev, header, cb) {
  if (prev instanceof bitcore.BlockHeader) {
    header = prev
    prev = this.tip
  }

  var self = this
  var height = prev.height + 1
  var block = {
    height: height,
    hash: u.toHash(header.hash),
    header: header
  }

  if (header.prevHash.compare(prev.hash) !== 0) {
    return cb(new Error('Block does not connect to previous'), block)
  }
  if (!self.shouldRetarget(height) && header.bits !== prev.header.bits) {
    return cb(new Error('Unexpected difficulty change'), block)
  }
  if (!header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'), block)
  }
  // TODO: other checks (timestamp, version)
  if (self.shouldRetarget(height)) {
    return self.calculateTarget(block, function (err, target) {
      if (err) return cb(err, block)

      var expected = toCompactTarget(target)
      if (expected !== header.bits) {
        return cb(new Error('Bits in block (' + header.bits.toString(16) + ')' +
          ' is different than expected (' + expected.toString(16) + ')'))
      }
      put()
    })
  }
  put()

  function put () {
    var tip = height > self.tip.height
    self.store.put({ header: header, height: height }, { tip: tip, prev: prev }, function (err) {
      if (err) return cb(err)

      if (tip) {
        self.tip.height = height
        self.tip.hash = block.hash
        self.tip.header = header
        block.syncing = self.syncing
        self.emit('block', block)
      }

      cb(null, block)
    })
  }
}

Blockchain.prototype.shouldRetarget = function (height) {
  return !(height % this.interval)
}

Blockchain.prototype.calculateTarget = function (block, cb) {
  var self = this

  var endBlock = null
  var startBlock = null

  function calculate () {
    var timespan = endBlock.header.time - startBlock.header.time
    timespan = Math.max(timespan, self.targetTimespan / 4)
    timespan = Math.min(timespan, self.targetTimespan * 4)

    var target = endBlock.header.getTargetDifficulty()
    target.imul(new BN(timespan))
    target.idivn(new BN(self.targetTimespan))

    if (target.cmp(self.maxTarget) === 1) {
      target = self.maxTarget
    }

    return cb(null, target)
  }

  var i = 0
  function traverse (block) {
    self.store.get(block.header.prevHash, function (err, prev) {
      if (err) return cb(err)
      if (i === 0) endBlock = prev
      i++
      if (i === self.interval) {
        startBlock = prev
        return calculate()
      }
      setImmediate(function () { traverse(prev) })
    })
  }
  traverse(block)
}

function toCompactTarget (target) {
  var exponent = Math.ceil(target.bitLength() / 8)
  var targetString = target.toString(16)
  if (targetString.length % 2 === 1) targetString = '0' + targetString
  var mantissa = Number.parseInt(targetString.substr(0, 6), 16)
  if (mantissa & 0x800000) {
    mantissa >>= 8
    exponent++
  }
  return (exponent << 24) | mantissa
}
