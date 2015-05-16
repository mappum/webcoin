#!/usr/bin/env node

var Networks = require('bitcore').Networks
var Bridge = require('../lib/bridge.js')
var argv = require('minimist')(process.argv.slice(2))

var bridge = new Bridge({
  network: argv.testnet ? Networks.testnet : Networks.livenet,
  localPeer: argv.local
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
