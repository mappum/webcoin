#!/usr/bin/env node

var Networks = require('bitcore').Networks
var Node = require('../lib/node.js')

var node = new Node({
  network: Networks.livenet,
  path: 'data',
  acceptWeb: true
})
node.on('error', function (err) {
  console.error(err)
})
node.peers
  .on('peerconnect', function (peer) {
    console.log('Connected to peer:', peer.remoteAddress, peer.subversion)
  })
  .on('peerdisconnect', function (peer) {
    console.log('Disconnected from peer:', peer.remoteAddress, peer.subversion)
  })
node.chain
  .on('sync', function (tip) {
    var max = node.chain.syncHeight
    if (!max && node.chain.downloadPeer) node.chain.downloadPeer.bestHeight
    console.log('Sync progress:', tip.height + ' / ' + max,
      '(' + (Math.round(tip.height / max * 1000) / 10) + '%)',
      '-', new Date(tip.header.time * 1000))
  })
  .on('synced', function (tip) {
    console.log('Done syncing. Now at height: ' + tip.height + ', hash: ' + tip.header.hash)
  })
node.start()
