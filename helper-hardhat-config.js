// Chain ID
const LOCALHOST_CHAIN_ID = 31337;
const MUMBAI_CHAIN_ID = 137;
const MAINNET_CHAIN_ID = 80001;

// Block Confirmations
const BLOCK_CONFIRMATIONS = 6;
const LOCAL_NETWORK_BLOCK_CONFIRMATIONS = 1;


// Governor Values
const QUORUM_PERCENTAGE = 4; // 4% of voters to pass
const MIN_DELAY = 3600; // 1 hour - after a vote passes, you have 1 hour before you can enact
const VOTING_PERIOD = 5; // blocks
const VOTING_DELAY = 1; // 1 block till a proposal vote becomes active
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

// Contract Arguments
const WITHDRAW_FEE_PERCENTAGE = 1;
const POLYGON_MAINNET_USDT_CONTRACT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const POLYGON_MAINNET_DAI_CONTRACT_ADDRESS = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";


chainIds = {
    localhost: LOCALHOST_CHAIN_ID,
    mumbai: MUMBAI_CHAIN_ID,
    mainnet: MAINNET_CHAIN_ID
}

const networkConfig = {
    hardhat: {
        name: "hardhat",
        blockConfirmations: LOCAL_NETWORK_BLOCK_CONFIRMATIONS,
    },
    [LOCALHOST_CHAIN_ID]: {
        name: "localhost",
        blockConfirmations: LOCAL_NETWORK_BLOCK_CONFIRMATIONS,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
    [MUMBAI_CHAIN_ID]: {
        name: "mumbai",
        blockConfirmations: BLOCK_CONFIRMATIONS,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
    [MAINNET_CHAIN_ID]: {
        name: "mainnet",
        blockConfirmations: BLOCK_CONFIRMATIONS,
        usdtContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        daiContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    chainIds,
    networkConfig,
    developmentChains,
    WITHDRAW_FEE_PERCENTAGE,
    MIN_DELAY,
    QUORUM_PERCENTAGE,
    VOTING_PERIOD,
    VOTING_DELAY,
    ADDRESS_ZERO,
}
