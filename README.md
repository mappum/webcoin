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

I am currently making some major refactors to the codebase, and documenting all of it. Much of the code in this repo is being broken out into smaller modules, each with comprehensive tests and docs.

### Modules

| module | version | tests | description |
|---|---|---|---|
| **[webcoin][webcoin]** | [![][webcoin-ni]][webcoin-nu] | [![][webcoin-ti]][webcoin-tu] | **SPV Bitcoin client for Node and the browser (this module)**
| [peer-exchange][peer-exchange] | [![][peer-exchange-ni]][peer-exchange-nu] | [![][peer-exchange-ti]][peer-exchange-tu] | Decentralized p2p signalling and discovery
| [blockchain-spv][blockchain-spv] | [![][blockchain-spv-ni]][blockchain-spv-nu] | [![][blockchain-spv-ti]][blockchain-spv-tu] | Stores blockchain headers and verifies with SPV
| [bitcoin-util][bitcoin-util] | [![][bitcoin-util-ni]][bitcoin-util-nu] | [![][bitcoin-util-ti]][bitcoin-util-tu] | Utility functions for Bitcoin hashes and targets
| [bitcoin-merkle-proof][bitcoin-merkle-proof] | [![][bitcoin-merkle-proof-ni]][bitcoin-merkle-proof-nu] | [![][bitcoin-merkle-proof-ti]][bitcoin-merkle-proof-tu] | Verify bitcoin Merkle proofs
| [bitcoin-wallet][bitcoin-wallet] | [![][bitcoin-util-ni]][bitcoin-util-nu] | [![][bitcoin-protocol-ti]][bitcoin-protocol-tu] | Sends and receives coins
| [bitcoin-net][bitcoin-net] | [![][bitcoin-net-ni]][bitcoin-net-nu] | [![][bitcoin-net-ti]][bitcoin-net-tu] | High-level Bitcoin networking
| [bitcoin-protocol][bitcoin-protocol] | [![][bitcoin-protocol-ni]][bitcoin-protocol-nu] | [![][bitcoin-protocol-ti]][bitcoin-protocol-tu] | Bitcoin network protocol streams
| [webcoin-bridge][webcoin-bridge] | [![][webcoin-bridge-ni]][webcoin-bridge-nu] | [![][webcoin-bridge-ti]][webcoin-bridge-tu] | A proxy that bridges the Bitcoin TCP and WebRTC networks
| [webcoin-params][webcoin-params] | [![][webcoin-params-ni]][webcoin-params-nu] | [![][webcoin-params-ti]][webcoin-params-tu] | Abstract parameters, used for supporting other cryptocurrencies
| [webcoin-param-tests][webcoin-param-tests] | [![][webcoin-param-tests-ni]][webcoin-param-tests-nu] | [![][webcoin-param-tests-ti]][webcoin-param-tests-tu] | Tests for parameters
| [electron-webrtc][electron-webrtc] | [![][electron-webrtc-ni]][electron-webrtc-nu] | [![][electron-webrtc-ti]][electron-webrtc-tu] | WebRTC for Node via a hidden Electron process

[webcoin]: https://github.com/mappum/webcoin
[webcoin-ni]: https://img.shields.io/npm/v/webcoin.svg
[webcoin-nu]: https://www.npmjs.com/package/webcoin
[webcoin-ti]:https://travis-ci.org/mappum/webcoin.svg?branch=master
[webcoin-tu]: https://travis-ci.org/mappum/webcoin

[peer-exchange]: https://github.com/mappum/peer-exchange
[peer-exchange-ni]: https://img.shields.io/npm/v/peer-exchange.svg
[peer-exchange-nu]: https://www.npmjs.com/package/peer-exchange
[peer-exchange-ti]:https://travis-ci.org/mappum/peer-exchange.svg?branch=master
[peer-exchange-tu]: https://travis-ci.org/mappum/peer-exchange

[blockchain-spv]: https://github.com/mappum/blockchain-spv
[blockchain-spv-ni]: https://img.shields.io/npm/v/blockchain-spv.svg
[blockchain-spv-nu]: https://www.npmjs.com/package/blockchain-spv
[blockchain-spv-ti]:https://travis-ci.org/mappum/blockchain-spv.svg?branch=master
[blockchain-spv-tu]: https://travis-ci.org/mappum/blockchain-spv

[bitcoin-util]: https://github.com/mappum/bitcoin-util
[bitcoin-util-ni]: https://img.shields.io/npm/v/bitcoin-util.svg
[bitcoin-util-nu]: https://www.npmjs.com/package/bitcoin-util
[bitcoin-util-ti]: https://travis-ci.org/mappum/bitcoin-util.svg?branch=master
[bitcoin-util-tu]: https://travis-ci.org/mappum/bitcoin-util

[bitcoin-merkle-proof]: https://github.com/mappum/bitcoin-merkle-proof
[bitcoin-merkle-proof-ni]: https://img.shields.io/npm/v/bitcoin-merkle-proof.svg
[bitcoin-merkle-proof-nu]: https://www.npmjs.com/package/bitcoin-merkle-proof
[bitcoin-merkle-proof-ti]: https://travis-ci.org/mappum/bitcoin-merkle-proof.svg?branch=master
[bitcoin-merkle-proof-tu]: https://travis-ci.org/mappum/bitcoin-merkle-proof

[bitcoin-wallet]: https://github.com/mappum/bitcoin-wallet
[bitcoin-wallet-ni]: https://img.shields.io/npm/v/bitcoin-wallet.svg
[bitcoin-wallet-nu]: https://www.npmjs.com/package/bitcoin-wallet
[bitcoin-wallet-ti]: https://travis-ci.org/mappum/bitcoin-wallet.svg?branch=master
[bitcoin-wallet-tu]: https://travis-ci.org/mappum/bitcoin-wallet

[bitcoin-net]: https://github.com/mappum/bitcoin-net
[bitcoin-net-ni]: https://img.shields.io/npm/v/bitcoin-net.svg
[bitcoin-net-nu]: https://www.npmjs.com/package/bitcoin-net
[bitcoin-net-ti]: https://travis-ci.org/mappum/bitcoin-net.svg?branch=master
[bitcoin-net-tu]: https://travis-ci.org/mappum/bitcoin-net

[bitcoin-protocol]: https://github.com/mappum/bitcoin-protocol
[bitcoin-protocol-ni]: https://img.shields.io/npm/v/bitcoin-protocol.svg
[bitcoin-protocol-nu]: https://www.npmjs.com/package/bitcoin-protocol
[bitcoin-protocol-ti]: https://travis-ci.org/mappum/bitcoin-protocol.svg?branch=master
[bitcoin-protocol-tu]: https://travis-ci.org/mappum/bitcoin-protocol

[webcoin-bridge]: https://github.com/mappum/webcoin-bridge
[webcoin-bridge-ni]: https://img.shields.io/npm/v/webcoin-bridge.svg
[webcoin-bridge-nu]: https://www.npmjs.com/package/webcoin-bridge
[webcoin-bridge-ti]: https://travis-ci.org/mappum/webcoin-bridge.svg?branch=master
[webcoin-bridge-tu]: https://travis-ci.org/mappum/webcoin-bridge

[webcoin-params]: https://github.com/mappum/webcoin-params
[webcoin-params-ni]: https://img.shields.io/npm/v/webcoin-params.svg
[webcoin-params-nu]: https://www.npmjs.com/package/webcoin-params
[webcoin-params-ti]: https://travis-ci.org/mappum/webcoin-params.svg?branch=master
[webcoin-params-tu]: https://travis-ci.org/mappum/webcoin-params

[webcoin-param-tests]: https://github.com/mappum/webcoin-param-tests
[webcoin-param-tests-ni]: https://img.shields.io/npm/v/webcoin-param-tests.svg
[webcoin-param-tests-nu]: https://www.npmjs.com/package/webcoin-param-tests
[webcoin-param-tests-ti]: https://travis-ci.org/mappum/webcoin-param-tests.svg?branch=master
[webcoin-param-tests-tu]: https://travis-ci.org/mappum/webcoin-param-tests

[electron-webrtc]: https://github.com/mappum/electron-webrtc
[electron-webrtc-ni]: https://img.shields.io/npm/v/electron-webrtc.svg
[electron-webrtc-nu]: https://www.npmjs.com/package/electron-webrtc
[electron-webrtc-ti]: https://travis-ci.org/mappum/electron-webrtc.svg?branch=master
[electron-webrtc-tu]: https://travis-ci.org/mappum/electron-webrtc

#### Networks
- [x]  [`webcoin-bitcoin`](https://github.com/mappum/webcoin-bitcoin) - Bitcoin params for Webcoin
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
