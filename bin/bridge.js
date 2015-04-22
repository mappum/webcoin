#!/usr/bin/env node

var PeerGroup = require('../lib/peerGroup.js');
var BlockStore = require('../lib/blockStore.js');
var Blockchain = require('../lib/blockchain.js');
var Networks = require('bitcore').Networks;

var dataPath = './data';
var network = Networks.livenet;

var peers = new PeerGroup({ acceptWeb: true, verbose: true });
var store = new BlockStore({ path: dataPath+'/'+network.name+'.chain' });
var chain = new Blockchain({ peerGroup: peers, store: store, network: network });

peers.on('peerconnect', function(peer) {
  console.log('Connected to peer:', peer.remoteAddress, peer.subversion);

  peer.on('disconnect', function() {
    console.log('Disconnected from peer:', peer.remoteAddress, peer.subversion);
  });
});
peers.connect();

chain.on('sync', function(tip) {
  console.log('Sync progress:', tip.height, new Date(tip.header.time * 1000));
});
chain.sync();
