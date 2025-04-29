# DeFi Exchange DAO (Hardhat)
Decentralized Finance Exchange Decentralized Autonomous Organization

[![DFED](https://circleci.com/gh/v7m/defi-exchange-dao-hardhat.svg?style=shield)](https://app.circleci.com/pipelines/github/v7m/defi-exchange-dao-hardhat)

> *This is an educational project with the purpose of acquiring hands-on experience in web3 application development using smart contracts written in Solidity.*

# Description

The DeFi Exchange DAO is a multifaceted decentralized finance platform, offering a range of DeFi services and functionalities. It operates with a select group of cryptocurrencies, specifically Ethereum (`ETH`), `DAI`, `USDT`, and Wrapped Ethereum (`WETH`), providing users with various options for their DeFi transactions. Key features of the platform include:

- **Deposits and Withdrawals**: Users can deposit and withdraw `ETH`, `DAI`, and `USDT`, facilitating flexible asset management.
- **ETH Staking for Governance Token**s: The platform allows `ETH` staking, enabling users to earn governance tokens, which are instrumental in participating in the platform's decision-making processes.
- **Token Swapping via Uniswap**: Users can swap between `ETH`, `DAI`, and `USDT` using the integrated `Uniswap` protocol, enhancing trading efficiency and accessibility.
- **Interaction with Aave Protocol**: The platform integrates with `Aave`, allowing users to deposit and borrow the supported tokens, adding layers of utility and financial opportunities.
- **Liquidity Provision and NFT Rewards**: Providing liquidity with the supported tokens earns users unique Liquidity Pool NFTs, representing their stake, which can be redeemed back for the initial tokens.
- **Decentralized Governance**: Operating under a DAO structure, the platform empowers its users to vote on key proposals and platform updates using their governance tokens, ensuring a democratic and community-driven approach.

This platform is designed to be a comprehensive DeFi solution, particularly focusing on `ETH`, `DAI`, and `USDT`, to cater to a broad spectrum of decentralized finance activities.

# Technical description

<img src="readme-images/schema.png" alt="image" width="500" height="auto" style="display: block; margin-left: auto; margin-right: auto;">

Deployed on the `Polygon` blockchain for its cost-efficiency, the DeFi Exchange DAO platform is crafted using Solidity and employs OpenZeppelin contracts for robust security and standardization, incorporating `ERC20` and `ERC721` standards for token operations. The system integrates with `Aave` and `Uniswap` for diverse DeFi functionalities. It features DAO governance for decentralized decision-making and an upgradable contract architecture, ensuring long-term adaptability and resilience. The platform's reliability is further reinforced through extensive unit and integration testing of all smart contracts.

## Built with

- **Solidity**: Primary language for Ethereum smart contract development.
- **OpenZeppelin Contracts**: For secure, standard smart contract implementations.
- **Aave and Uniswap Protocols**: Integrated for a broad range of DeFi services.
- **Hardhat**: Ethereum development environment for deployment and testing.
- **Ethers.js**: A JavaScript library used to interact with Ethereum blockchain.
- **Polygon Blockchain**: Chosen for its high efficiency and reduced transaction costs.

# Smart contract addresses

## Polygon Mumbai (testnet)

- **DeFi Exchange Implementation Contract**: [0x3347EA710D0908D6f552a2847E4Dc0c8F82E5c8A](https://mumbai.polygonscan.com/address/0x3347EA710D0908D6f552a2847E4Dc0c8F82E5c8A)
- **DeFi Exchange Proxy Contract**: [0xe60122D7098237493A9d42fd0131401Be09ba7BF](https://mumbai.polygonscan.com//address/0xe60122D7098237493A9d42fd0131401Be09ba7BF)
- **DeFi Exchange Proxy Admin Contract**: [0xE30dbe6759373ac5355BD21e93924f0Bcb416434](https://mumbai.polygonscan.com/address/0xE30dbe6759373ac5355BD21e93924f0Bcb416434)
- **Liquidity Pool NFT Contract**: [0xC0073C1B49EB02f047582bd5f20151A5fB2ed3f7](https://mumbai.polygonscan.com//address/0xC0073C1B49EB02f047582bd5f20151A5fB2ed3f7)
- **Governance Token Contract**: [0x0936195A7fd9a4b7C2192D2B1325aE9ceE0Ff887](https://mumbai.polygonscan.com//address/0x0936195A7fd9a4b7C2192D2B1325aE9ceE0Ff887)
- **Governor Contract**: [0xB6FE4cFD10d8738c2eD20F6f181D3a8bcFD1c803](https://mumbai.polygonscan.com/address/0xB6FE4cFD10d8738c2eD20F6f181D3a8bcFD1c803)
- **Time Lock Contract**: [0x4E34b641c204F17Af9a6bCD2897457afb2DAe14c](https://mumbai.polygonscan.com/address/0x4E34b641c204F17Af9a6bCD2897457afb2DAe14c)

# Getting Started

```bash
git clone https://github.com/v7m/defi-exchange-dao-hardhat
cd defi-exchange-dao-hardhat
yarn
```

# Usage

## Deploy

```bash
yarn hardhat deploy
```

## Testing

```bash
yarn hardhat test
```

## Coverage

```bash
yarn coverage
```

## Linting

```bash
yarn lint
```

## Static analysis

```bash
yarn slither
```
