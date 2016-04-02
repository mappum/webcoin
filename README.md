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

| module | version | tests | description |
|---|---|---|---|
| **[webcoin][webcoin]** | [![][webcoin-ni]][webcoin-nu] | [![][webcoin-ti]][webcoin-tu] | **Bitcoin client (this module)**
| [blockchain-spv][blockchain-spv] | [![][blockchain-spv-ni]][blockchain-spv-nu] | [![][blockchain-spv-ti]][blockchain-spv-tu] | Stores blockchain headers and verifies with SPV
| [bitcoin-util][bitcoin-util] | [![][bitcoin-util-ni]][bitcoin-util-nu] | [![][bitcoin-util-ti]][bitcoin-util-tu] | Utility functions for Bitcoin hashes and targets
| [bitcoin-merkle-proof][bitcoin-merkle-proof] | [![][bitcoin-merkle-proof-ni]][bitcoin-merkle-proof-nu] | [![][bitcoin-merkle-proof-ti]][bitcoin-merkle-proof-tu] | Verify bitcoin Merkle proofs
| bitcoin-wallet | | | Sends and receives coins, and stores unspent outputs
| [bitcoin-net][bitcoin-net] | [![][bitcoin-net-ni]][bitcoin-net-nu] | [![][bitcoin-net-ti]][bitcoin-net-tu] | High-level Bitcoin networking
| [bitcoin-protocol][bitcoin-protocol] | [![][bitcoin-protocol-ni]][bitcoin-protocol-nu] | [![][bitcoin-protocol-ti]][bitcoin-protocol-tu] | Bitcoin network protocol streams 
| [webcoin-bridge][webcoin-bridge] | [![][webcoin-bridge-ni]][webcoin-bridge-nu] | [![][webcoin-bridge-ti]][webcoin-bridge-tu] | A proxy that bridges the Bitcoin TCP and WebRTC networks

[webcoin]: https://github.com/mappum/webcoin
[webcoin-ni]: https://camo.githubusercontent.com/bcb8a7bfdc8ce7745beac50115019d1d39ecccb0/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f776562636f696e2e737667
[webcoin-nu]: https://www.npmjs.com/package/webcoin
[webcoin-ti]: https://camo.githubusercontent.com/60d5373475d25e70db688513f1b9f406ad451017/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f776562636f696e2e7376673f6272616e63683d6d6173746572
[webcoin-tu]: https://travis-ci.org/mappum/webcoin

[blockchain-spv]: https://github.com/mappum/blockchain-spv
[blockchain-spv-ni]: https://camo.githubusercontent.com/ce5a3a6bcde594ec8c73e66a7e8c90b0de3d81e3/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f626c6f636b636861696e2d7370762e737667
[blockchain-spv-nu]: https://www.npmjs.com/package/blockchain-spv
[blockchain-spv-ti]:  https://camo.githubusercontent.com/60e4780c8400c1cde10ecd9e3c41313f37d2cdd7/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f626c6f636b636861696e2d7370762e7376673f6272616e63683d6d6173746572
[blockchain-spv-tu]: https://travis-ci.org/mappum/blockchain-spv

[bitcoin-util]: https://github.com/mappum/bitcoin-util
[bitcoin-util-ni]: https://camo.githubusercontent.com/f90abaaec6646858d4f7a83a7bea2ba86904d543/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f626974636f696e2d7574696c2e737667
[bitcoin-util-nu]: https://www.npmjs.com/package/bitcoin-util
[bitcoin-util-ti]: https://camo.githubusercontent.com/3a7781f2002339550563cb6f3224ad96bf68300c/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f626974636f696e2d7574696c2e7376673f6272616e63683d6d6173746572
[bitcoin-util-tu]: https://travis-ci.org/mappum/bitcoin-util

[bitcoin-merkle-proof]: https://github.com/mappum/bitcoin-merkle-proof
[bitcoin-merkle-proof-ni]: https://camo.githubusercontent.com/ace7f04a5a431953657d03d6325bd2fb034ff3b9/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f626974636f696e2d6d65726b6c652d70726f6f662e737667
[bitcoin-merkle-proof-nu]: https://www.npmjs.com/package/bitcoin-merkle-proof
[bitcoin-merkle-proof-ti]: https://camo.githubusercontent.com/ad7008b3b3e2eb3a1763e07a7b5f03757adf2bbe/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f626974636f696e2d6d65726b6c652d70726f6f662e7376673f6272616e63683d6d6173746572
[bitcoin-merkle-proof-tu]: https://travis-ci.org/mappum/bitcoin-merkle-proof

[bitcoin-net]: https://github.com/mappum/bitcoin-net
[bitcoin-net-ni]: https://camo.githubusercontent.com/843561f1b2cfa707ffee0e453a8ec2f52f5a089e/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f626974636f696e2d6e65742e737667
[bitcoin-net-nu]: https://www.npmjs.com/package/bitcoin-net
[bitcoin-net-ti]: https://camo.githubusercontent.com/f93b3e1eb2227015e7416b18b293e2eb13e1b74d/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f626974636f696e2d6e65742e7376673f6272616e63683d6d6173746572
[bitcoin-net-tu]: https://travis-ci.org/mappum/bitcoin-net

[bitcoin-protocol]: https://github.com/mappum/bitcoin-protocol
[bitcoin-protocol-ni]: https://camo.githubusercontent.com/5176847ee4bfba849e0cd39218286e9661cef115/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f626974636f696e2d70726f746f636f6c2e737667
[bitcoin-protocol-nu]: https://www.npmjs.com/package/bitcoin-protocol
[bitcoin-protocol-ti]: https://camo.githubusercontent.com/ae26a6ad6790d5e2c03eccb1b1b981f12a44f3d5/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f626974636f696e2d70726f746f636f6c2e7376673f6272616e63683d6d6173746572
[bitcoin-protocol-tu]: https://travis-ci.org/mappum/bitcoin-protocol

[webcoin-bridge]: https://github.com/mappum/webcoin-bridge
[webcoin-bridge-ni]: https://camo.githubusercontent.com/6929c931706b81463ae7cdffefbe3c53cd069e9f/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f776562636f696e2d6272696467652e737667
[webcoin-bridge-nu]: https://www.npmjs.com/package/webcoin-bridge
[webcoin-bridge-ti]: https://camo.githubusercontent.com/e25e6ea369c85e1e5ba1d2214bafff19683b98c6/68747470733a2f2f7472617669732d63692e6f72672f6d617070756d2f776562636f696e2d6272696467652e7376673f6272616e63683d6d6173746572
[webcoin-bridge-tu]: https://travis-ci.org/mappum/webcoin-bridge

#### Parameters
- [x] [`webcoin-params`](https://github.com/mappum/webcoin-params) - Abstract params
- [x] [`webcoin-param-tests`](https://github.com/mappum/webcoin-param-tests) - Tests for params
- [x] [`webcoin-bitcoin`](https://github.com/mappum/webcoin-bitcoin) - Bitcoin params for Webcoin
- [x] [`webcoin-bitcoin-testnet`](https://github.com/mappum/webcoin-bitcoin-testnet) - Bitcoin Testnet 3 params for Webcoin
- [ ] `webcoin-litecoin` - Litecoin params for Webcoin
- [ ] `webcoin-zcash-alpha` - Zcash Alpha params for Webcoin
- [ ] `webcoin-elements-alpha` - Elements Alpha params for Webcoin

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
