var test = require('tape');
var bitcore = require('bitcore');
var BlockStore = require('../lib/blockStore.js');
var u = require('../lib/utils.js');

// TODO: get/setTip tests
// TODO: tests for put with { tip: true }

function createBlock() {
  var header = new bitcore.BlockHeader({
    version: 1,
    prevHash: u.toHash('0000000000000000000000000000000000000000000000000000000000000000'),
    merkleRoot: u.toHash('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'),
    time: Math.floor(Date.now() / 1000),
    bits: 0x1d00ffff,
    nonce: Math.floor(Math.random() * 0xffffff)
  });
  return { height: Math.floor(Math.random() * 400000), header: header };
}

test('open blockstore', function(t) {
  var bs1 = new BlockStore({ path: 'data/test.store' });
  bs1.on('error', t.error);

  // opening on a path that is alrady locked
  var bs2 = new BlockStore({ path: 'data/test.store' });
  bs2.on('error', function(err) {
    t.ok(err);
  });

  bs1.close(t.end);
});

test('blockstore put', function(t) {
  t.plan(7);

  var bs = new BlockStore({ path: 'data/test.store' });
  var block = createBlock();
  // simple put
  bs.put(block, t.error);
  // put existing block
  bs.put(block, t.error);
  // put invalid blocks
  bs.put({}, t.ok);
  bs.put({ height: 123 }, t.ok);
  bs.put({ header: block.header }, t.ok);

  bs.close(function(err) {
    t.error(err);
    // put after close
    bs.put(block, t.ok);
  });
});

test('blockstore get', function(t) {
  t.plan(14);

  var bs = new BlockStore({ path: './test.store' });
  var block1 = createBlock();
  bs.put(block1, function(err) {
    if(err) t.fail(err);

    // get using `header.hash`
    bs.get(block1.header.hash, function(err, block2) {
      t.error(err);
      // compare blocks
      t.equal(block1.height, block2.height);
      // NOTE: we have to access `header.hash` before comparing headers,
      // for the hash to actually be computed and cached
      t.equal(block1.header.hash, block2.header.hash);
      t.deepEqual(block1.header, block2.header);
    });

    // get using buffer hash
    bs.get(block1.header._getHash(), function(err, block2) {
      t.error(err);
      // compare blocks
      t.equal(block1.height, block2.height);
      // NOTE: we have to access `header.hash` before comparing headers,
      // for the hash to actually be computed and cached
      t.equal(block1.header.hash, block2.header.hash);
      t.deepEqual(block1.header, block2.header);
    });

    // get an invalid hash
    bs.get('1234', function(err, block2) {
      t.ok(err);
      t.equal(err.message, 'Invalid hash format');
      t.notOk(block2);
    });

    // get a valid, nonexistent hash
    var block3 = createBlock();
    bs.get(block3.header.hash, function(err, block2) {
      t.ok(err);
      t.equal(err.name, 'NotFoundError');
      t.notOk(block2);
    });
  });
});
