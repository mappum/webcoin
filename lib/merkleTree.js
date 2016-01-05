var bitcore = require('bitcore-lib')
var hash = bitcore.crypto.Hash.sha256sha256
var u = require('./utils.js')

function getBit (buffer, n) {
  return !!(buffer[Math.floor(n / 8)] & (1 << (n % 8)))
}

var MerkleTree = module.exports = function () {
  this.depth = 0
  this._root = null
  this.txids = []
}

MerkleTree.fromMerkleBlock = function (block) {
  var tree = new MerkleTree()
  var hashes = block.hashes
  var flags = block.flags

  tree.depth = Math.ceil(Math.log2(block.numTransactions))

  var h = 0
  var i = 0
  function getNode (depth, index) {
    var flag = getBit(flags, i++)
    var leaf = depth === tree.depth

    var hash = (leaf || !flag) ? new Buffer(hashes[h++], 'hex') : null
    var node = new Node(hash)
    if (leaf) {
      if (flag) tree.txids.push(hash)
    } else if (flag) {
      node.left = getNode(depth + 1, index)
      var rightIndex = index | (1 << (tree.depth - depth - 1))
      if (rightIndex < block.numTransactions) {
        node.right = getNode(depth + 1, rightIndex)
      }
    }

    return node
  }

  tree._root = getNode(0, 0)
  var root = tree._root.hash()

  if (h < hashes.length) throw new Error('Tree did not consume all hashes')
  if (root.compare(block.header.merkleRoot) !== 0) {
    throw new Error('Calculated Merkle root does not match header, calculated: ' +
      u.toHash(root).toString('hex') + ', header: ' + block.header.merkleRoot.toString('hex'))
  }

  return tree
}

MerkleTree.prototype.root = function () {
  return this._root.hash()
}

var Node = function (hash) {
  this._hash = hash
  this.left = null
  this.right = null
}
MerkleTree.Node = Node

Node.prototype.hash = function () {
  if (this._hash) return this._hash
  var leftHash = this.left.hash()
  var rightHash = (this.right || this.left).hash()
  if (this.right && leftHash.compare(rightHash) === 0) {
    throw new Error('Merkle child hashes are equivalent (%s)', u.toHash(leftHash).toString('hex'))
  }
  return hash(Buffer.concat([ leftHash, rightHash ]))
}
