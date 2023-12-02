require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";
const POLYGON_MAINNET_RPC_URL = process.env.POLYGON_MAINNET_RPC_URL || "";
const POLYGON_MUMBAI_RPC_URL = process.env.POLYGON_MUMBAI_RPC_URL || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const REPORT_GAS = process.env.REPORT_GAS || false;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            // forking: {
            //     enabled: true,
            //     url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            // }
        },
        localhost: {
            chainId: 31337,
        },
        mumbai: {
            url: POLYGON_MUMBAI_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 11155111,
        },
        mainnet: {
            url: POLYGON_MAINNET_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 1,
        }
    },
    etherscan: {
        apiKey: {
            sepolia: ETHERSCAN_API_KEY
        },
        customChains: []
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    contractSizer: {
        runOnCompile: false,
        only: [],
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0, // similarly on mainnet it will take the first account as deployer
        },
        player: {
            default: 1
        }
    },
    solidity: {
        compilers: [
            {
                version: "0.8.8",
                settings: {
                    outputSelection: {
                        "*": {
                            "*": ["storageLayout"],
                        }
                    }
                }
            }
        ]
    },
    mocha: {
        timeout: 200000, // 200 seconds max for running tests
    },
}
