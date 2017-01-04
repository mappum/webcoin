![Webcoin](img/logo.png)

### A Bitcoin client for Node.js and the browser

[![Build Status](https://travis-ci.org/mappum/webcoin.svg?branch=master)](https://travis-ci.org/mappum/webcoin)
[![Dependency Status](https://david-dm.org/mappum/webcoin.svg)](https://david-dm.org/mappum/webcoin)
[![npm version](https://img.shields.io/npm/v/webcoin.svg)](https://www.npmjs.com/package/webcoin)

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

Webcoin is made up of many small modules, most of which can each be used independently.

| module | version | tests | issues | description |
|---|---|---|---|---|
| **[webcoin][webcoin]** | [![][webcoin-ni]][webcoin-nu] | [![][webcoin-ti]][webcoin-tu] | [![][webcoin-ii]][webcoin-iu] | **SPV Bitcoin client for Node and the browser (this module)** |
| [peer-exchange][peer-exchange] | [![][peer-exchange-ni]][peer-exchange-nu] | [![][peer-exchange-ti]][peer-exchange-tu] | [![][peer-exchange-ii]][peer-exchange-iu] | Decentralized p2p signalling and discovery |
| [blockchain-spv][blockchain-spv] | [![][blockchain-spv-ni]][blockchain-spv-nu] | [![][blockchain-spv-ti]][blockchain-spv-tu] | [![][blockchain-spv-ii]][blockchain-spv-iu] | Stores blockchain headers and verifies with SPV |
| [blockchain-download][blockchain-download] | [![][blockchain-download-ni]][blockchain-download-nu] | [![][blockchain-download-ti]][blockchain-download-tu] | [![][blockchain-download-ii]][blockchain-download-iu] | Download blockchain data from peers |
| [bitcoin-wallet][bitcoin-wallet] | [![][bitcoin-wallet-ni]][bitcoin-wallet-nu] | [![][bitcoin-protocol-ti]][bitcoin-protocol-tu] | [![][bitcoin-wallet-ii]][bitcoin-wallet-iu] | Sends and receives coins
| [bitcoin-protocol][bitcoin-protocol] | [![][bitcoin-protocol-ni]][bitcoin-protocol-nu] | [![][bitcoin-protocol-ti]][bitcoin-protocol-tu] | [![][bitcoin-protocol-ii]][bitcoin-protocol-iu] | Bitcoin network protocol streams |
| [bitcoin-inventory][bitcoin-inventory] | [![][bitcoin-inventory-ni]][bitcoin-inventory-nu] | [![][bitcoin-inventory-ti]][bitcoin-inventory-tu] | [![][bitcoin-inventory-ii]][bitcoin-inventory-iu] | Exchange transactions with peers |
| [bitcoin-util][bitcoin-util] | [![][bitcoin-util-ni]][bitcoin-util-nu] | [![][bitcoin-util-ti]][bitcoin-util-tu] | [![][bitcoin-util-ii]][bitcoin-util-iu] | Utility functions for Bitcoin hashes and targets |
| [bitcoin-merkle-proof][bitcoin-merkle-proof] | [![][bitcoin-merkle-proof-ni]][bitcoin-merkle-proof-nu] | [![][bitcoin-merkle-proof-ti]][bitcoin-merkle-proof-tu] | [![][bitcoin-merkle-proof-ii]][bitcoin-merkle-proof-iu] | Verify bitcoin Merkle proofs |
| [bitcoin-filter][bitcoin-filter] | [![][bitcoin-filter-ni]][bitcoin-filter-nu] | [![][bitcoin-filter-ti]][bitcoin-filter-tu] | [![][bitcoin-filter-ii]][bitcoin-filter-iu] | Bloom filtering (BIP37) |
| [webcoin-bridge][webcoin-bridge] | [![][webcoin-bridge-ni]][webcoin-bridge-nu] | [![][webcoin-bridge-ti]][webcoin-bridge-tu] | [![][webcoin-bridge-ii]][webcoin-bridge-iu] | A proxy that bridges the Bitcoin TCP and WebRTC networks |
| [webcoin-params][webcoin-params] | [![][webcoin-params-ni]][webcoin-params-nu] | [![][webcoin-params-ti]][webcoin-params-tu] | [![][webcoin-params-ii]][webcoin-params-iu] | Abstract parameters, used for supporting other cryptocurrencies |
| [webcoin-param-tests][webcoin-param-tests] | [![][webcoin-param-tests-ni]][webcoin-param-tests-nu] | [![][webcoin-param-tests-ti]][webcoin-param-tests-tu] | [![][webcoin-param-tests-ii]][webcoin-param-tests-iu] | Tests for parameters |
| [electron-webrtc][electron-webrtc] | [![][electron-webrtc-ni]][electron-webrtc-nu] | [![][electron-webrtc-ti]][electron-webrtc-tu] | [![][electron-webrtc-ii]][electron-webrtc-iu] | WebRTC for Node via a hidden Electron process |

[webcoin]: https://github.com/mappum/webcoin
[webcoin-ni]: https://img.shields.io/npm/v/webcoin.svg
[webcoin-nu]: https://www.npmjs.com/package/webcoin
[webcoin-ti]:https://travis-ci.org/mappum/webcoin.svg?branch=master
[webcoin-tu]: https://travis-ci.org/mappum/webcoin
[webcoin-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin.svg
[webcoin-iu]: https://github.com/mappum/webcoin/issues

[peer-exchange]: https://github.com/mappum/peer-exchange
[peer-exchange-ni]: https://img.shields.io/npm/v/peer-exchange.svg
[peer-exchange-nu]: https://www.npmjs.com/package/peer-exchange
[peer-exchange-ti]:https://travis-ci.org/mappum/peer-exchange.svg?branch=master
[peer-exchange-tu]: https://travis-ci.org/mappum/peer-exchange
[peer-exchange-ii]: https://img.shields.io/github/issues-raw/mappum/peer-exchange.svg
[peer-exchange-iu]: https://github.com/mappum/peer-exchange/issues

[blockchain-spv]: https://github.com/mappum/blockchain-spv
[blockchain-spv-ni]: https://img.shields.io/npm/v/blockchain-spv.svg
[blockchain-spv-nu]: https://www.npmjs.com/package/blockchain-spv
[blockchain-spv-ti]:https://travis-ci.org/mappum/blockchain-spv.svg?branch=master
[blockchain-spv-tu]: https://travis-ci.org/mappum/blockchain-spv
[blockchain-spv-ii]: https://img.shields.io/github/issues-raw/mappum/blockchain-spv.svg
[blockchain-spv-iu]: https://github.com/mappum/blockchain-spv/issues

[blockchain-download]: https://github.com/mappum/blockchain-download
[blockchain-download-ni]: https://img.shields.io/npm/v/blockchain-download.svg
[blockchain-download-nu]: https://www.npmjs.com/package/blockchain-download
[blockchain-download-ti]:https://travis-ci.org/mappum/blockchain-download.svg?branch=master
[blockchain-download-tu]: https://travis-ci.org/mappum/blockchain-download
[blockchain-download-ii]: https://img.shields.io/github/issues-raw/mappum/blockchain-download.svg
[blockchain-download-iu]: https://github.com/mappum/blockchain-download/issues

[bitcoin-inventory]: https://github.com/mappum/bitcoin-inventory
[bitcoin-inventory-ni]: https://img.shields.io/npm/v/bitcoin-inventory.svg
[bitcoin-inventory-nu]: https://www.npmjs.com/package/bitcoin-inventory
[bitcoin-inventory-ti]: https://travis-ci.org/mappum/bitcoin-inventory.svg?branch=master
[bitcoin-inventory-tu]: https://travis-ci.org/mappum/bitcoin-inventory
[bitcoin-inventory-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-inventory.svg
[bitcoin-inventory-iu]: https://github.com/mappum/bitcoin-inventory/issues

[bitcoin-util]: https://github.com/mappum/bitcoin-util
[bitcoin-util-ni]: https://img.shields.io/npm/v/bitcoin-util.svg
[bitcoin-util-nu]: https://www.npmjs.com/package/bitcoin-util
[bitcoin-util-ti]: https://travis-ci.org/mappum/bitcoin-util.svg?branch=master
[bitcoin-util-tu]: https://travis-ci.org/mappum/bitcoin-util
[bitcoin-util-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-util.svg
[bitcoin-util-iu]: https://github.com/mappum/bitcoin-util/issues

[bitcoin-merkle-proof]: https://github.com/mappum/bitcoin-merkle-proof
[bitcoin-merkle-proof-ni]: https://img.shields.io/npm/v/bitcoin-merkle-proof.svg
[bitcoin-merkle-proof-nu]: https://www.npmjs.com/package/bitcoin-merkle-proof
[bitcoin-merkle-proof-ti]: https://travis-ci.org/mappum/bitcoin-merkle-proof.svg?branch=master
[bitcoin-merkle-proof-tu]: https://travis-ci.org/mappum/bitcoin-merkle-proof
[bitcoin-merkle-proof-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-merkle-proof.svg
[bitcoin-merkle-proof-iu]: https://github.com/mappum/bitcoin-merkle-proof/issues

[bitcoin-filter]: https://github.com/mappum/bitcoin-filter
[bitcoin-filter-ni]: https://img.shields.io/npm/v/bitcoin-filter.svg
[bitcoin-filter-nu]: https://www.npmjs.com/package/bitcoin-filter
[bitcoin-filter-ti]: https://travis-ci.org/mappum/bitcoin-filter.svg?branch=master
[bitcoin-filter-tu]: https://travis-ci.org/mappum/bitcoin-filter
[bitcoin-filter-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-filter.svg
[bitcoin-filter-iu]: https://github.com/mappum/bitcoin-filter/issues

[bitcoin-wallet]: https://github.com/mappum/bitcoin-wallet
[bitcoin-wallet-ni]: https://img.shields.io/npm/v/bitcoin-wallet.svg
[bitcoin-wallet-nu]: https://www.npmjs.com/package/bitcoin-wallet
[bitcoin-wallet-ti]: https://travis-ci.org/mappum/bitcoin-wallet.svg?branch=master
[bitcoin-wallet-tu]: https://travis-ci.org/mappum/bitcoin-wallet
[bitcoin-wallet-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-wallet.svg
[bitcoin-wallet-iu]: https://github.com/mappum/bitcoin-wallet/issues

[bitcoin-net]: https://github.com/mappum/bitcoin-net
[bitcoin-net-ni]: https://img.shields.io/npm/v/bitcoin-net.svg
[bitcoin-net-nu]: https://www.npmjs.com/package/bitcoin-net
[bitcoin-net-ti]: https://travis-ci.org/mappum/bitcoin-net.svg?branch=master
[bitcoin-net-tu]: https://travis-ci.org/mappum/bitcoin-net
[bitcoin-net-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-net.svg
[bitcoin-net-iu]: https://github.com/mappum/bitcoin-net/issues

[bitcoin-protocol]: https://github.com/mappum/bitcoin-protocol
[bitcoin-protocol-ni]: https://img.shields.io/npm/v/bitcoin-protocol.svg
[bitcoin-protocol-nu]: https://www.npmjs.com/package/bitcoin-protocol
[bitcoin-protocol-ti]: https://travis-ci.org/mappum/bitcoin-protocol.svg?branch=master
[bitcoin-protocol-tu]: https://travis-ci.org/mappum/bitcoin-protocol
[bitcoin-protocol-ii]: https://img.shields.io/github/issues-raw/mappum/bitcoin-protocol.svg
[bitcoin-protocol-iu]: https://github.com/mappum/bitcoin-protocol/issues

[webcoin-bridge]: https://github.com/mappum/webcoin-bridge
[webcoin-bridge-ni]: https://img.shields.io/npm/v/webcoin-bridge.svg
[webcoin-bridge-nu]: https://www.npmjs.com/package/webcoin-bridge
[webcoin-bridge-ti]: https://travis-ci.org/mappum/webcoin-bridge.svg?branch=master
[webcoin-bridge-tu]: https://travis-ci.org/mappum/webcoin-bridge
[webcoin-bridge-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-bridge.svg
[webcoin-bridge-iu]: https://github.com/mappum/webcoin-bridge/issues

[webcoin-params]: https://github.com/mappum/webcoin-params
[webcoin-params-ni]: https://img.shields.io/npm/v/webcoin-params.svg
[webcoin-params-nu]: https://www.npmjs.com/package/webcoin-params
[webcoin-params-ti]: https://travis-ci.org/mappum/webcoin-params.svg?branch=master
[webcoin-params-tu]: https://travis-ci.org/mappum/webcoin-params
[webcoin-params-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-params.svg
[webcoin-params-iu]: https://github.com/mappum/webcoin-params/issues

[webcoin-param-tests]: https://github.com/mappum/webcoin-param-tests
[webcoin-param-tests-ni]: https://img.shields.io/npm/v/webcoin-param-tests.svg
[webcoin-param-tests-nu]: https://www.npmjs.com/package/webcoin-param-tests
[webcoin-param-tests-ti]: https://travis-ci.org/mappum/webcoin-param-tests.svg?branch=master
[webcoin-param-tests-tu]: https://travis-ci.org/mappum/webcoin-param-tests
[webcoin-param-tests-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-param-tests.svg
[webcoin-param-tests-iu]: https://github.com/mappum/webcoin-param-tests/issues

[electron-webrtc]: https://github.com/mappum/electron-webrtc
[electron-webrtc-ni]: https://img.shields.io/npm/v/electron-webrtc.svg
[electron-webrtc-nu]: https://www.npmjs.com/package/electron-webrtc
[electron-webrtc-ti]: https://travis-ci.org/mappum/electron-webrtc.svg?branch=master
[electron-webrtc-tu]: https://travis-ci.org/mappum/electron-webrtc
[electron-webrtc-ii]: https://img.shields.io/github/issues-raw/mappum/electron-webrtc.svg
[electron-webrtc-iu]: https://github.com/mappum/electron-webrtc/issues

#### Parameters

Webcoin was built from the ground-up with multiple cryptocurrencies in mind. The following modules are parameters which can be plugged in to Webcoin in order to support other currency networks.

| network | module | version | tests |
|---|---|---|---|
| Bitcoin | [webcoin-bitcoin][webcoin-bitcoin] | [![][webcoin-bitcoin-ni]][webcoin-bitcoin-nu] | [![][webcoin-bitcoin-ti]][webcoin-bitcoin-tu] |
| Bitcoin Testnet | [webcoin-bitcoin-testnet][webcoin-bitcoin-testnet] | [![][webcoin-bitcoin-testnet-ni]][webcoin-bitcoin-testnet-nu] | [![][webcoin-bitcoin-testnet-ti]][webcoin-bitcoin-testnet-tu] |
| Litecoin | [webcoin-litecoin][webcoin-litecoin] (UNFINISHED) | [![][webcoin-litecoin-ni]][webcoin-litecoin-nu] | [![][webcoin-litecoin-ti]][webcoin-litecoin-tu] |
| Zcash Alpha | [webcoin-zcash-alpha][webcoin-zcash-alpha] (UNFINISHED) | [![][webcoin-zcash-alpha-ni]][webcoin-zcash-alpha-nu] | [![][webcoin-zcash-alpha-ti]][webcoin-zcash-alpha-tu] |


[webcoin-bitcoin]: https://github.com/mappum/webcoin-bitcoin
[webcoin-bitcoin-ni]: https://img.shields.io/npm/v/webcoin-bitcoin.svg
[webcoin-bitcoin-nu]: https://www.npmjs.com/package/webcoin-bitcoin
[webcoin-bitcoin-ti]: https://travis-ci.org/mappum/webcoin-bitcoin.svg?branch=master
[webcoin-bitcoin-tu]: https://travis-ci.org/mappum/webcoin-bitcoin
[webcoin-bitcoin-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-bitcoin.svg
[webcoin-bitcoin-iu]: https://github.com/mappum/webcoin-bitcoin/issues

[webcoin-bitcoin-testnet]: https://github.com/mappum/webcoin-bitcoin-testnet
[webcoin-bitcoin-testnet-ni]: https://img.shields.io/npm/v/webcoin-bitcoin-testnet.svg
[webcoin-bitcoin-testnet-nu]: https://www.npmjs.com/package/webcoin-bitcoin-testnet
[webcoin-bitcoin-testnet-ti]: https://travis-ci.org/mappum/webcoin-bitcoin-testnet.svg?branch=master
[webcoin-bitcoin-testnet-tu]: https://travis-ci.org/mappum/webcoin-bitcoin-test
[webcoin-bitcoin-test-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-bitcoin-test.svg
[webcoin-bitcoin-test-iu]: https://github.com/mappum/webcoin-bitcoin-test/issues

[webcoin-litecoin]: https://github.com/mappum/webcoin-litecoin
[webcoin-litecoin-ni]: https://img.shields.io/npm/v/webcoin-litecoin.svg
[webcoin-litecoin-nu]: https://www.npmjs.com/package/webcoin-litecoin
[webcoin-litecoin-ti]: https://travis-ci.org/mappum/webcoin-litecoin.svg?branch=master
[webcoin-litecoin-tu]: https://travis-ci.org/mappum/webcoin-litecoin
[webcoin-litecoin-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-litecoin.svg
[webcoin-litecoin-iu]: https://github.com/mappum/webcoin-litecoin/issues

[webcoin-zcash-alpha]: https://github.com/mappum/webcoin-zcash-alpha
[webcoin-zcash-alpha-ni]: https://img.shields.io/npm/v/webcoin-zcash-alpha.svg
[webcoin-zcash-alpha-nu]: https://www.npmjs.com/package/webcoin-zcash-alpha
[webcoin-zcash-alpha-ti]: https://travis-ci.org/mappum/webcoin-zcash-alpha.svg?branch=master
[webcoin-zcash-alpha-tu]: https://travis-ci.org/mappum/webcoin-zcash-alpha
[webcoin-zcash-alpha-ii]: https://img.shields.io/github/issues-raw/mappum/webcoin-zcash-alpha.svg
[webcoin-zcash-alpha-iu]: https://github.com/mappum/webcoin-zcash-alpha/issues

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
