![Webcoin](img/logo.png)

### A Bitcoin client for Node.js and the browser

[![Build Status](https://travis-ci.org/mappum/webcoin.svg?branch=master)](https://travis-ci.org/mappum/webcoin)
[![Dependency Status](https://david-dm.org/mappum/webcoin.svg)](https://david-dm.org/mappum/webcoin)
[![npm version](https://img.shields.io/npm/v/webcoin.svg)](https://www.npmjs.com/package/webcoin)
[![Join the chat at https://gitter.im/mappum/webcoin](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mappum/webcoin?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

----

Webcoin is a Bitcoin client that works in Node.js and the browser. In the browser, it uses WebRTC to make P2P connections rather than relying on a centralized server to get data (like all the other JS Bitcoin libraries). It's kind of like the Bitcoin equivalent of [WebTorrent](https://github.com/feross/webtorrent).

You can use Webcoin to add Bitcoin payments to your application, without the need to hold your users' funds, and without making them trust any third-parties with their money. Webcoin is an [SPV](https://en.bitcoin.it/wiki/Thin_Client_Security#Simplified_Payment_Verification_.28SPV.29_Clients) light client, so it only uses a minimal amount of bandwidth and storage; it even works great on mobile devices!

## Status

Much of Webcoin is already written and works well, including:

- Downloading block headers from peers
- Verifying block headers
- Creating HD wallets
- Filtering transactions with Bloom filters
- Detecting incoming transactions confirmed in blocks

I am currently making some major refactors to the codebase, and documenting all of it. Much of the code in this repo is being broken out into smaller modules, each with comprehensive tests and docs. You can see the progress below:

### Roadmap

- [x] [`blockchain-spv`](https://github.com/mappum/blockchain-spv) - Stores blockchain headers and verifies with SPV
- [x] [`bitcoin-util`](https://github.com/mappum/bitcoin-util) - Utility functions for Bitcoin hashes and targets
- [x] [`bitcoin-merkle-tree`](https://github.com/mappum/bitcoin-merkle-treel) - Verify bitcoin Merkle trees (BIP37)
- [ ] `bitcoin-wallet` - Sends and receives coins, and stores unspent outputs
- [ ] `bitcoin-net` - Bitcoin networking that works in Node and the browser
- [ ] `bitcoin-web-bridge` - A proxy that bridges the Bitcoin TCP and WebRTC networks
- [ ] Parameters
  - [x] [`webcoin-bitcoin`](https://github.com/mappum/webcoin-bitcoin) - Bitcoin constants and network rules to use with Webcoin
  - [ ] `webcoin-testnet3` - Bitcoin Testnet 3 constants and network rules to use with Webcoin
  - [ ] `webcoin-litecoin` - Litecoin constants and network rules to use with Webcoin
  - [ ] `webcoin-zcash-testnet` - Zcash Testnet constants and network rules to use with Webcoin
  - [ ] `webcoin-elements-alpha` - Elements Alpha constants and network rules to use with Webcoin

## License (MIT)

Copyright 2015 Matt Bell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
