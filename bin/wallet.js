#!/usr/bin/env node

var Networks = require('bitcore-lib').Networks
var Node = require('../lib/node.js')

var node = new Node({
  network: Networks.livenet,
  wrtc: require('wrtc'),
  path: 'data',
  acceptWeb: true
})
node.on('error', function (err) {
  console.error(err)
})

node.peers.on('peer', function (peer) {
  console.log('Connected to peer:', peer.remoteAddress, peer.subversion)
  peer.on('disconnect', function () {
    console.log('Disconnected from peer:', peer.remoteAddress, peer.subversion)
  })
})

node.chain
  .on('syncing', function (peer) {
    console.log('Downloading block(s) from peer:', peer.remoteAddress, peer.subversion)
  })
  .on('sync', function (tip) {
    var max = node.chain.syncHeight
    if (!max && node.chain.downloadPeer) max = node.chain.downloadPeer.bestHeight
    console.log('Chain sync progress:', tip.height + ' / ' + max,
      '(' + (Math.round(tip.height / max * 1000) / 10) + '%)',
      '-', new Date(tip.header.time * 1000).toLocaleDateString())
  })
  .on('synced', function (tip) {
    console.log('Chain up-to-date. height: ' + tip.height +
      ', hash: ' + tip.header.hash)
  })
  .on('block', function (block) {
    if (node.chain.syncing) return
    console.log('Received a new block. height: ' + block.height +
      ', hash: ' + block.header.hash)
  })
node.start()

var w = node.createWallet('main', function (err) {
  if (err) return console.error(err)
  console.log('Wallet address:', w.getAddress().toString())
})
w.on('error', function (err) {
  console.error(err, err.stack)
})
w.on('receive', function (e) {
  console.log('Received funds: ' + e.amount + ' satoshis, txid: ' + e.transaction.hash)
})
w.on('send', function (e) {
  console.log('Sent funds: ' + e.amount + ' satoshis, txid: ' + e.transaction.hash)
})
w.on('sync', function (block) {
  console.log('Wallet synced to height ' + block.height)
})
w.on('syncing', function (tip) {
  console.log('Starting wallet sync, currently at height ' + tip.height)
})
