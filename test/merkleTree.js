var test = require('tape')
var MerkleTree = require('../lib/merkleTree.js')

test('build from MerkleBlock', function (t) {
  t.test('bitcoin.org example', function (t) {
    t.doesNotThrow(function () {
      var tree = MerkleTree.fromMerkleBlock({
        flags: [ 0x1d ],
        hashes: [
          '3612262624047ee87660be1a707519a443b1c1ce3d248cbfc6c15870f6c5daa2',
          '019f5b01d4195ecbc9398fbf3c3b1fa9bb3183301d7a1fb3bd174fcfa40a2b65',
          '41ed70551dd7e841883ab8f0b16bf04176b7d1480e4f0af9f3d4c3595768d068',
          '20d2a7bc994987302e5b1ac80fc425fe25f8b63169ea78e68fbaaefa59379bbf'
        ],
        numTransactions: 7,
        header: {
          merkleRoot: new Buffer('7f16c5962e8bd963659c793ce370d95f093bc7e367117b3c30c1f8fdd0d97287', 'hex')
        }
      })
      t.ok(tree._root)
      t.ok(tree._root.left)
      t.notOk(tree._root.left.left)
      t.ok(tree._root.right)
      t.ok(tree._root.right.left.left)
      t.ok(tree._root.right.left.right)
      t.end()
    })
  })

  t.test('block 1', function (t) {
    t.doesNotThrow(function () {
      var tree = MerkleTree.fromMerkleBlock({
        flags: [ 109, 117, 0 ],
        hashes: [
          '97929f984c3188642c9732ea6df79f669c00fc213eecbfe568167a4a633cefb4',
          '6c243e0cfb25519bfdbc9a46184ac637557fd16a469e0b1d6489df82bd43f98d',
          'e51ac3a2e43d1b3360913db73e8e7559a37c0a26cd47a4e0c2a7ee7a6af6394d',
          'b4232ddd34821c98fbe92d0a8994e8c3d6eda738ba6c01d3fe436e5afe17ec73',
          'ff6a1f2453a773dead88d5352a8f9876c58d099cdcae55cb2aa562bb202c4024',
          '52a88d05f0f4c46681bae3be39c35391db370d41a2197f72f616b2ee47698f6f',
          '9d5493b33f4042bccc0f0745315c69f7f39317964288a7fd56c4a4bf3b12bed4',
          'ed8ba481ad870d0c25fd8fd07a9346212434749eb5f031e70332347c8232e377',
          'eba009b7beb9b2215ef4e73627513251fc373a41838e58ff12fa45a46fb7025e'
        ],
        numTransactions: 362,
        header: {
          merkleRoot: new Buffer('fb2e2ca078055ef2d41ef23f957c3723c53e067a81ebe7d5686e2d88be7189cc', 'hex')
        }
      })
      t.ok(tree._root)
      t.end()
    })
  })

  t.test('block 2', function (t) {
    t.doesNotThrow(function () {
      var tree = MerkleTree.fromMerkleBlock({
        flags: [ 223, 29, 212, 170, 92, 181, 250, 7 ],
        hashes: [
          'c02b8e5039f74be95fa2f6d1d5101e8c41f0185a8e554529c714a12682f764f3',
          'fcadd26e3c38b87c9b5329bcdfb8cbf227160ffba5a2240b587de5d68ad797f7',
          'cd6521bb842834048b0ed70b20aa0f1453122ad1a6071f27fa53e618d2171648',
          '92ae11c16cfe57afb5ca7f9152e88088ecb791adcce0fc524d9d9d1577256ab1',
          '20d885d84a34ab33bda8f8c01698719caf77629cdac6c21ae26cb5d13e4209b8',
          '6ee74c47907bf68a8b74a1670b14912b00b432e281e5742765667c36e3bfcc5f',
          '0a408277c56e47e58a083bfed5b3d21d9170286b450b56e1f24193e893c6873e',
          '77d32d571e80f5fa6d5dac2819f59479abff03e806ff161d0cba11224cbab88f',
          'fe8ef657e0ff35b4134016001934c94059aa41818e46ade42fa631c15b5bab47',
          '43511a1f76d7eee38222d673ac2f955afdc131d5873c161ebfa1e3471bf208b1',
          '0725dfd95dc3df820bb89f12d973299921872cf9c2390454e5d18b1914bee334',
          '4accc5767c46851942b5cfc05c3c76f45f505c93ab75a8dcda3d319a7ff659e2',
          'ba3743264a1b3943b244043a42c60a086a685ba25526d7a215de5be3ed3e40bb',
          '350b7343850bf554a5e9bc041b37378b4bb34963330e374424c6e211ff19e537',
          '358728dc4d81aac33230d586aee9ee60d82f52db6f4373e62b30b6ee0f0c166b',
          '4c200e284365de8345a65fc02cba877a7d4d1caceb8ee381e677913266ebdd27',
          '645e6deebcf9aab65125b989ad94965a36c95a03192c7851671d00fe87848180',
          '2b1f4b0c48c1baac465ecfa660001354a2d0755c3441f72b21f992afe315d0b9',
          '4dab81c832cf684b4d2b9575acbfef3444f25e5af4931ad9746203466e0bf8f1',
          '709d7b67cc0c66c305a4b24443fe208f8430480d373e562f2d18ab03b0233dbf',
          '8c8d1827bac3f35d0b276c9050c9f2d2a0390847fe689794fa964cfdd21bd129',
          '87c60fff3ab167c1b93eb0f323fc8b079602fdd2ff12c28bc05334265eb65b9e',
          'c117fa49c502a77b89f23ed1659d5f0020d206f95a87967983cbefbd7507b8be',
          '22d37f04728fb5c74a46612053af64fe6bea74648b01868f19ea2ac0f56309a1',
          'e6d9ff6748cbb4342c2fb9404768803ab469f1b43a484a7f1b40ded52c176cb6',
          '80ab6ad2938a2bc9bcdd7d1ad9cda511d44650aeccf73ad3386e3a6604942209',
          'a36e484fc411901ee32461ce7b0d1eae93f9d00eb0ddbe22e589e414a0b60163',
          '6c8d1222e00925561537a9bd443f05108d7388ceb1fd57b4217bce575e0e72b0'
        ],
        numTransactions: 644,
        header: {
          merkleRoot: new Buffer('ca52ca1771f88ed3929ba5a662537af319db203dbb8b38f79d712d68b9c708c2', 'hex')
        }
      })
      t.ok(tree._root)
      t.end()
    })
  })


  t.end()
})
