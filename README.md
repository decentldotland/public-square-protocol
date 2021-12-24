# Public Square

<p align="center">
  <a href="https://decent.land">
    <img src="./src/utils/img/logo25.png" height="124">
  </a>
  <h3 align="center"><code>a permissionless social feed</code></h3>
  <p align="center">protocol's documentation</p>
</p>


# Synopsis
The [publicSquare](https://twitter.com/samecwilliams/status/1347741160165531655?lang=en) is a data protocol for an unbiased public square on the Arweave network. Decentland extends the PublicSquare protocol into an open Tribus of unpermissioned access.

# Specification
Unlike PublicSquare V1, this specification introduces a new philosophical experience where digital identities (digital properties) communicate through digital assets (posts). hence, each publication (post, reply, repost) packs its content into a tokenized asset, an atomic NFT.

- supported MIME type: `application/json`
- Publication actions: `post` , `reply`, and `repost`
- Asset type: Atomic NFT
- Supported social identities: [ANS](https://github.com/decentldotland/ANS/) labels

## Key features
DecentLand extends the PublicSquare protocol into a decentralized social feed where Arweave Identities (Profit Sharing Domains) can interact and communicate with each other via tokenized data assets (atomicNFTs). It can be simplified into "tokenized communication".

The DecentLand implementation of the PublicSquare add to the publications the ability to be considered and treated as assets: transferable & trade-able
## Protocol Level Publication Actions:

### Action post

|  Tag Key  |  Tag Value  | 
| :-----------: | :-----------: |
| App-Name      | PublicSquare | 
| Version       | testnet-v{x} |
| Type          | post          |
| Content-Type  | application/json |
| App-Name      | SmartWeaveContract |
| App-Version   | 0.3.0              |
| Contract-Src  | [-xoIBH2TxLkVWo6XWAjdwXZmTbUH09_hPYD6itHFeZY](https://viewblock.io/arweave/tx/-xoIBH2TxLkVWo6XWAjdwXZmTbUH09_hPYD6itHFeZY) |
| Init-State    | [standard-post-state](./postTypes/standard/post_nft.json) |

### Disclamer
DecentLand by no means guarantees the financial valuation of publication's aNFTs, the social consensus does. Posts tokenization is created to introduce a new social experience.

# License
This project is licensed under the MIT license.
