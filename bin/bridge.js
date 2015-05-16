#!/usr/bin/env node

var Networks = require('bitcore').Networks

var Bridge = require('../lib/bridge.js')
var bridge = new Bridge({
  network: Networks.defaultNetwork // TODO: CLI option to use testnet
})

bridge.on('connection', function (peer, id) {
  console.log('Incoming connection:', id)
  peer.on('disconnect', function () {
    console.log('Disconnected from peer:', id)
  })
  peer.on('error', function (err) {
    console.error('Peer error:', err)
  })
})

bridge.on('bridge', function (webPeer, tcpPeer) {
  console.log('Bridging WebRTC connection to tcp://' + tcpPeer.remoteAddress + ':' + tcpPeer.remotePort)
})
