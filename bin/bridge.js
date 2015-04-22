#!/usr/bin/env node

var WebPeer = require('../lib/webPeer.js');
var PeerGroup = require('../lib/peerGroup.js');
var BlockStore = require('../lib/blockStore.js');
var Blockchain = require('../lib/blockchain.js');
var Networks = require('bitcore').Networks;

var dataPath = './data';
var network = Networks.livenet;

var peers = new PeerGroup({ acceptWeb: true, verbose: true });
var store = new BlockStore({ path: dataPath+'/'+network.name });
var chain = new Blockchain({ peerGroup: peers, store: store, network: network });

peers.on('peerconnect', function(peer) {
  var uri = peer.host+':'+peer.port;
  if(peer instanceof WebPeer) uri = '(WebRTC)';

  console.log('Connected to peer:', uri, peer.subversion);

  peer.on('disconnect', function() {
    console.log('Disconnected from peer:', uri, peer.subversion);
  });
});
peers.connect();

chain.on('sync', function(tip) {
  console.log('Sync progress:', tip.height, new Date(tip.header.time * 1000));
});
chain.sync();
