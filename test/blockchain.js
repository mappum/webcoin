var test = require('tape');
var PeerGroup = require('../lib/peerGroup.js');
var BlockStore = require('../lib/blockStore.js');
var Blockchain = require('../lib/blockchain.js');

var storePath = 'data/' + process.pid + '.store';

test('creating blockchain instances', function(t) {
  t.plan(3);

  var peers = new PeerGroup;

  t.test('create blockchain without required options', function(t) {
    t.throws(function() {
      new Blockchain;
    });
    t.throws(function() {
      new Blockchain({ peerGroup: peers });
    });
    t.throws(function() {
      new Blockchain({ store: store });
    });
    t.end();
  });

  t.test('create blockchain with instantiated BlockStore', function(t) {
    var store = new BlockStore({ path: storePath });

    t.doesNotThrow(function() {
      new Blockchain({ peerGroup: peers, store: store });
      store.close(t.end);
    });
  });

  t.test('create blockchain with path instead of instantiated BlockStore', function(t) {
    t.doesNotThrow(function() {
      var chain = new Blockchain({
        peerGroup: peers,
        path: storePath
      });
      chain.store.close(t.end);
    });
  });
});

test('blockchain sync', { timeout: 30 * 1000 }, function(t) {
  t.plan(7);

  var peers = new PeerGroup;
  peers.connect();

  var store = new BlockStore({
    path: storePath,
    reset: function(err) {
      t.error(err);

      var chain = new Blockchain({ peerGroup: peers, store: store });

      chain.on('syncing', function(peer) {
        t.ok(peer);
      });
      chain.on('synced', function(tip) {
        t.ok(tip);
        t.equal(tip.height, 3000);
      });
      chain.sync({ to: 3000 }, function(block) {
        t.ok(block);
        t.equal(block.height, 3000);
        t.equal(block.header.hash, '000000004a81b9aa469b11649996ecb0a452c16d1181e72f9f980850a1c5ecce');

        peers.disconnect();
        store.close(t.end);
      });
    }
  });
});
