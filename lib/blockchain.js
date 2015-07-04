var EventEmitter = require('events').EventEmitter
var util = require('util')
var async = require('async')
var bitcore = require('bitcore')
var Inventory = require('bitcore-p2p').Inventory
var BN = bitcore.crypto.BN
var constants = require('./constants.js')
var BlockStore = require('./blockStore.js')
var u = require('./utils.js')

if (process.browser) {
  require('setimmediate')
}

function noop () {}

var TIME_MARGIN = 2 * 60 * 60
var storeClosedError = new Error('Store is closed')

var Blockchain = module.exports = function (opts) {
  var self = this
  opts = opts || {}
  this.peerGroup = opts.peerGroup
  this.network = bitcore.Networks.get(opts.network) || bitcore.Networks.defaultNetwork

  var genesisHeader = opts.genesis || constants.genesisHeaders[this.network.name]
  this.genesis = this.tip = {
    height: 0,
    hash: u.toHash(genesisHeader.hash),
    header: genesisHeader
  }

  this.BlockHeader = genesisHeader.constructor

  if (opts.checkpoint && !opts.to) {
    this.checkpoint = opts.checkpoint
    this.checkpoint.hash = u.toHash(this.checkpoint.header.hash)
    this.tip = this.checkpoint
  }
  this.to = opts.to

  this.initialized = false
  this.closed = false

  this.store = opts.store || new BlockStore({
    path: opts.path,
    BlockHeader: this.BlockHeader
  })
  this._initStore(function (err) {
    if (err && err !== storeClosedError) return self._error(err)
    else if (err && err === storeClosedError) return
    self.initialized = true
    self.emit('ready')
  })

  this.downloadPeer = null
  this.syncing = false
  this.initialized = false
  this.syncHeight = 0
  this.lastInv = null

  this.interval = opts.interval || 2016
  this.targetSpacing = opts.targetSpacing || 10 * 60
  this.targetTimespan = this.interval * this.targetSpacing
  this.maxTarget = opts.maxTarget || constants.maxTarget

  this._onHeaders = this._onHeaders.bind(this)
  this._onDownloadPeerDisconnect = this._onDownloadPeerDisconnect.bind(this)
}
util.inherits(Blockchain, EventEmitter)

Blockchain.prototype._initStore = function (cb) {
  var self = this

  function putIfNotFound (block) {
    return function (cb) {
      self.store.get(block.hash, function (err) {
        if (err && !err.notFound) return cb(err)
        if (self.closed || self.store.isClosed()) return cb(storeClosedError)
        self.store.put(block, cb)
      })
    }
  }

  var tasks = [ putIfNotFound(this.genesis) ]
  if (this.checkpoint) tasks.push(putIfNotFound(this.checkpoint))
  async.parallel(tasks, cb)
}

Blockchain.prototype.waitForReady = function (cb) {
  if (this.initialized) return cb()
  this.on('ready', cb)
}

Blockchain.prototype.close = function (cb) {
  var self = this
  this.waitForReady(function () {
    self.closed = true
    self.syncing = false
    self.store.close(cb)
  })
}

Blockchain.prototype.sync = function (opts, cb) {
  var self = this
  cb = cb || noop
  if (this.syncing) return cb(null)
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  if (cb) this.once('synced', cb)

  this.syncing = true
  if (opts.to || this.to) this.syncHeight = opts.to || this.to
  if (opts.peer) this._setDownloadPeer(opts.peer)

  var syncDone = function () {
    var done = false
    if (self.syncHeight) {
      done = self.tip.height >= self.syncHeight
    } else {
      done = self.downloadPeer && self.tip.height >= self.downloadPeer.bestHeight
    }
    if (done) {
      self.removeListener('sync', syncDone)
      self.removeListener('syncing', syncDone)
      self.syncing = false
      self._setDownloadPeer(null)
      self.emit('synced', self.tip)
      self._listenForUpdates()
    }
  }
  this.on('sync', syncDone)
  this.on('syncing', syncDone)

  var startDownload = function (err) {
    if (err) {
      err = new Error('Error initializing blockchain: ' + err)
      if (cb) return cb(err)
      else self.emit('error', err)
    }
    self._getHeaders()
  }
  if (!this.initialized) this._initialize(startDownload)
  else startDownload(null)
}

Blockchain.prototype.getTip = function () {
  return this.tip
}

Blockchain.prototype.getPath = function (from, to, cb) {
  var self = this
  var output = {
    add: [],
    remove: [],
    fork: null
  }

  var top, bottom, down
  if (from.height > to.height) {
    top = from
    bottom = to
    down = true
  } else {
    top = to
    bottom = from
    down = false
  }

  function addTraversedBlock (block) {
    if (down && block.header.hash !== to.header.hash) output.remove.push(block)
    else if (!down && block.header.hash !== from.header.hash) output.add.unshift(block)
  }

  // traverse down from the higher block to the lower block
  function traverseDown (err, block) {
    if (err) return cb(err)
    if (block.height === bottom.height) {
      // we traversed down to the lower height
      if (block.header.hash === bottom.header.hash) {
        // the blocks are the same, there was no fork
        addTraversedBlock(block)
        return cb(null, output)
      }
      // the blocks are not the same, so we need to traverse down to find a fork
      return traverseToFork(block, bottom)
    }
    addTraversedBlock(block)
    self._get(block.header.prevHash, traverseDown)
  }
  traverseDown(null, top)

  // traverse down from both blocks until we find one block that is the same
  function traverseToFork (left, right) {
    if (left.height === 0 || right.height === 0) {
      // we got all the way to two different genesis blocks,
      // the blocks don't have a path between thems
      return cb(new Error('Blocks are not in the same chain'))
    }

    output.remove.push(down ? left : right)
    output.add.unshift(down ? right : left)

    self._get(left.header.prevHash, function (err, left) {
      if (err) return cb(err)
      self._get(right.header.prevHash, function (err, right) {
        if (err) return cb(err)
        if (left.header.hash === right.header.hash) {
          output.fork = left
          return cb(null, output)
        }
        traverseToFork(left, right)
      })
    })
  }
}

Blockchain.prototype.getPathToTip = function (from, cb) {
  this.getPath(from, this.tip, cb)
}

Blockchain.prototype.getBlockAtTime = function (time, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  opts.margin = opts.margin != null ? opts.margin : TIME_MARGIN

  var output = this.tip
  function traverse (err, block) {
    if (err) return cb(err)
    if (block.header.time <= time - opts.margin) return cb(null, output)
    if (block.header.time >= time) output = block
    if (block.height === 0) return cb(null, output)
    self._get(block.header.prevHash, traverse)
  }
  traverse(null, this.tip)
}

Blockchain.prototype.getBlockAtHeight = function (height, cb) {
  var self = this

  if (height > this.tip.height) return cb(new Error('height is higher than tip'))
  if (height < 0) return cb(new Error('height must be >= 0'))

  var down = height > this.tip.height / 2

  function traverse (err, block) {
    if (err) return cb(err)
    if (block.height === height) return cb(null, block)
    self._get(down ? block.header.prevHash : block.next, traverse)
  }
  this._get(down ? this.tip.hash : this.genesis.hash, traverse)
}

Blockchain.prototype.getBlock = function (at, cb) {
  // hash
  if (Buffer.isBuffer(at)) return this._get(at, cb)
  if (typeof at === 'number') {
    // height
    if (at < constants.timestampThreshold) {
      return this.getBlockAtHeight(at, cb)
    }
    // timestamp
    return this.getBlockAtTime(at, cb)
  }

  return cb(new Error('"at" must be a block hash, height, or timestamp'))
}

Blockchain.prototype.getLocator = function (from, cb) {
  this.getBlock(from, function (err, block) {
    if (err) return cb(err)
    // TODO: include some previous blocks in case we are on a fork
    return cb(null, [ u.toHash(block.header.hash) ])
  })
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
    this.peerGroup.once('peer', function () {
      self._findDownloadPeer(cb)
    })
    return
  }

  var peer = this.peerGroup.randomPeer()
  this._setDownloadPeer(peer)
  return cb(null, peer)
}

Blockchain.prototype._setDownloadPeer = function (peer) {
  if (this.downloadPeer) {
    this.downloadPeer.removeListener('headers', this._onHeaders)
    this.downloadPeer.removeListener('disconnect', this._onDownloadPeerDisconnect)
  }

  this.downloadPeer = peer
  this.syncing = !!peer
  if (peer) {
    peer.on('headers', this._onHeaders)
    peer.on('disconnect', this._onDownloadPeerDisconnect)
    this.emit('syncing', peer)
  }
}

Blockchain.prototype._getHeaders = function (opts) {
  var self = this

  if (!this.syncing) return
  if (!this.downloadPeer) {
    this._findDownloadPeer(function (err, peer) {
      if (err) return self._error(err)
      self._getHeaders(opts)
    })
    return
  }

  opts = opts || {}
  this.getLocator(opts.from || this.tip.hash, function (err, locator) {
    if (err) return self._error(err)
    if (!self.downloadPeer) return
    var message = self.downloadPeer.messages.GetHeaders({
      starts: locator
    })
    self.downloadPeer.sendMessage(message)
  })
}

Blockchain.prototype._onHeaders = function (message) {
  var self = this
  if (message.headers.length === 0) return
  this.processHeaders(message.headers, function (err, last) {
    if (err) {
      return self._error(new Error('Peer sent invalid headers: ' + err.message))
    }
    if (self.syncing) {
      self.emit('sync', last)
      self._getHeaders()
    }
  })
}

Blockchain.prototype._onDownloadPeerDisconnect = function () {
  this.downloadPeer = null
  if (this.syncing) this._getHeaders()
}

Blockchain.prototype._listenForUpdates = function () {
  var self = this
  this.peerGroup.on('inv', function (peer, message) {
    message.inventory.forEach(function (item) {
      if (item.type === Inventory.TYPE.BLOCK ||
      item.type === Inventory.TYPE.FILTERED_BLOCK) {
        if (self.lastInv && self.lastInv.compare(item.hash) === 0) return
        self.lastInv = item.hash
        self.sync({ peer: peer })
      }
    })
  })
}

Blockchain.prototype._get = function (hash, cb) {
  var self = this
  if (!this.initialized) {
    this.once('ready', function () { self._get(hash, cb) })
    return
  }
  this.store.get(hash, cb)
}

Blockchain.prototype._put = function (hash, opts, cb) {
  var self = this
  if (!this.initialized) {
    this.once('ready', function () { self._put(hash, opts, cb) })
    return
  }
  this.store.put(hash, opts, cb)
}

Blockchain.prototype.processHeaders = function (headers, cb) {
  var self = this

  var previousTip = this.tip

  this._get(headers[0].prevHash, function (err, start) {
    if (err && err.name === 'NotFoundError') return cb(new Error('Block does not connect to chain'))
    if (err) return cb(err)
    start.hash = u.toHash(start.header.hash)

    if (self.syncHeight && start.height + headers.length > self.syncHeight) {
      headers = headers.slice(0, start.height + headers.length - self.syncHeight)
    }

    async.reduce(headers, start, self.processHeader.bind(self), function (err, last) {
      if (err) return cb(err, last)

      if (last.height > previousTip.height) {
        self.getPath(previousTip, last, function (err, path) {
          if (err) return cb(err, last)
          if (path.remove.length > 0) {
            var first = { height: start.height + 1, header: headers[0] }
            self.store.put(first, { best: true, prev: start }, function (err) {
              if (err) return cb(err)
              self.emit('reorg', { remove: path.remove, tip: last })
              cb(null, last)
            })
            return
          }
          cb(null, last)
        })
        return
      }

      cb(null, last)
    })
  })
}

Blockchain.prototype.processHeader = function (prev, header, cb) {
  if (!cb) cb = typeof header === 'function' ? header : cb
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
  // TODO: testnet difficulty rules (for now we are just not verifying testnet block difficulty)
  if (this.network !== bitcore.Networks.testnet &&
  !self.shouldRetarget(height) &&
  header.bits !== prev.header.bits) {
    return cb(new Error('Unexpected difficulty change'), block)
  }
  if (!header.validProofOfWork()) {
    return cb(new Error('Invalid proof of work'), block)
  }
  // TODO: other checks (timestamp, version)
  if (self.shouldRetarget(height) &&
  // don't verify retarget if it requires checking before our checkpoint
  !(this.checkpoint && height - this.checkpoint.height < this.interval)) {
    return self.calculateTarget(block, function (err, target) {
      if (err) return cb(err, block)

      var expected = u.toCompactTarget(target)
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
    self._put({ header: header, height: height }, { tip: tip, prev: prev }, function (err) {
      if (err) return cb(err)

      if (tip) {
        self.tip = block
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
