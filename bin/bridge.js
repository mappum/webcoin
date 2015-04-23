#!/usr/bin/env node

var async = require('async');
var Networks = require('bitcore').Networks;

var PeerGroup = require('../lib/peerGroup.js');
var BlockStore = require('../lib/blockStore.js');
var Blockchain = require('../lib/blockchain.js');
var u = require('../lib/utils.js');

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

  peer.on('getheaders', function(message) {
    sendHeaders(peer, message);
  });
});
peers.connect();

chain.on('sync', function(tip) {
  var max = chain.downloadPeer.startHeight;
  console.log('Sync progress:', tip.height + ' / ' + max,
    '(' + (Math.round(tip.height / max * 1000) / 10) + '%)',
    '-', new Date(tip.header.time * 1000));
});
chain.on('synced', function(tip) {
  console.log('Done syncing');
});
chain.sync();

function sendHeaders(peer, message) {
  var start = null;
  var headers = [];

  function next(err, block) {
    if(err) return console.error(err);
    headers.push(block.header);
    if(headers.length === 2000 || !block.next) {
      peer.sendMessage(peer.messages.Headers(headers));
      return;
    }
    store.get(block.next, next);
  }

  async.each(message.starts, function(hash, cb) {
    store.get(hash, function(err, block) {
      if(err && err.name === 'NotFoundError') return cb(null);
      if(err) return cb(err);
      if(block) {
        start = block;
        return cb(true);
      }
    });
  }, function(err) {
    if(err !== true) return console.error(err);
    if(!start || !start.next) return;
    store.get(start.next, next);
  });
}
