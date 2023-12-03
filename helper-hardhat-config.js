const WITHDRAW_FEE_PERCENTAGE = 1;
const POLYGON_MAINNET_USDT_CONTRACT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const POLYGON_MAINNET_DAI_CONTRACT_ADDRESS = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

const networkConfig = {
    default: {
        name: "hardhat",
    },
    31337: {
        name: "localhost",
        withdrawFeePercentage: WITHDRAW_FEE_PERCENTAGE,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
    137: {
        name: "mumbai",
        withdrawFeePercentage: WITHDRAW_FEE_PERCENTAGE,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
    80001: {
        name: "mainnet",
        withdrawFeePercentage: WITHDRAW_FEE_PERCENTAGE,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}