var bitcore = require('bitcore')
var hash = bitcore.crypto.Hash.sha256sha256

var MerkleTree = module.exports = function () {
  this.depth = 0
  this._root = null
  this.txids = []
  this.matched = []
}

MerkleTree.fromMerkleBlock = function (block) {
  var tree = new MerkleTree()
  var hashes = block.hashes
  var flags = block.flags

  tree.depth = Math.ceil(Math.log(block.numTransactions) / Math.log(2))
  var stack = []

  for (var i = 0; i < flags.length; i++) {
    var flag = flags[i]
    var node
    var depth = stack.length
    var leaf = depth === tree.depth
    var cursor = stack[stack.length - 1]

    if (leaf) {
      node = new Node(hashes.shift())
      tree.txids.push(hash)
      if (flag) tree.matched.push(hash)
    } else {
      node = new Node(flag ? null : hashes.shift())

      if (cursor) {
        var left = cursor.add(node)
        if (!left && !flag) cursor = stack.pop()
      }

      if (flag) stack.push(node)
    }

    if (!i) tree._root = node
  }

  return tree
}

MerkleTree.prototype.root = function () {
  return this._root.getHash()
}

var Node = function (hash) {
  this.hash = hash
  this.left = null
  this.right = null
}
MerkleTree.Node = Node

Node.prototype.getHash = function () {
  if (this.hash) return this.hash
  var leftHash = this.left.getHash()
  var rightHash = (this.right || this.left).getHash()
  return hash(leftHash.concat(rightHash))
}

Node.prototype.add = function (child) {
  var left = !this.left
  this[left ? 'left' : 'right'] = child
  return left
}
