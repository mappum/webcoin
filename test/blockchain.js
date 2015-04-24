var test = require('tape');
var PeerGroup = require('../lib/peerGroup.js');
var BlockStore = require('../lib/blockStore.js');
var Blockchain = require('../lib/blockchain.js');

test('creating blockchain instances', function(t) {
  t.plan(7);

  var peers = new PeerGroup;
  var store = new BlockStore({ path: 'data/test.store' });

  // create blockchain without required options
  t.throws(function() {
    new Blockchain;
  });
  t.throws(function() {
    new Blockchain({ peerGroup: peers });
  });
  t.throws(function() {
    new Blockchain({ store: store });
  });

  // create blockchain with instantiated BlockStore
  t.doesNotThrow(function() {
    new Blockchain({ peerGroup: peers, store: store });
    store.close(function(err) {
      t.error(err);      

      // create blockchain with path instead of instantiated BlockStore
      t.doesNotThrow(function() {
        var chain = new Blockchain({
          peerGroup: peers,
          path: 'data/test.store'
        });
        chain.store.close(t.error);
      });
    });
  });
});

test('blockchain sync', { timeout: 30 * 1000 }, function(t) {
  t.plan(7);

  var peers = new PeerGroup;
  peers.connect();

  var store = new BlockStore({
    path: 'data/test.store',
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
