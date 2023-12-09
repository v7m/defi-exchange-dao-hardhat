// Chain ID
const LOCALHOST_CHAIN_ID = 31337;
const MUMBAI_CHAIN_ID = 137;
const MAINNET_CHAIN_ID = 80001;

// Block Confirmations
const BLOCK_CONFIRMATIONS = 6;
const LOCAL_NETWORK_BLOCK_CONFIRMATIONS = 1;

// Contract Arguments
const WITHDRAW_FEE_PERCENTAGE = 1;
const STAKING_TO_GOVERNANCE_PERCENTAGE = 100;
const POLYGON_MAINNET_USDT_CONTRACT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const POLYGON_MAINNET_DAI_CONTRACT_ADDRESS = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
const POLYGON_MAINNET_WETH_CONTRACT_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const UNISWAP_POOL_FEE = 3000; // 0.3%
const POLYGON_MAINNET_SWAP_ROUTER_CONTRACT_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const POLYGON_MAINNET_AAVE_WETH_GATEWAY_CONTRACT_ADDRESS = "0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c";
const POLYGON_MAINNET_AAVE_POOL_ADDRESSES_PROVIDER_ADDRESS = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";

// Governor Values
const QUORUM_PERCENTAGE = 4; // 4% of voters to pass
const MIN_DELAY = 3600; // 1 hour - after a vote passes, you have 1 hour before you can enact
const VOTING_PERIOD = 5; // blocks
const VOTING_DELAY = 1; // 1 block till a proposal vote becomes active
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

// Proposal Values
const PROPOSAL_NEW_STORE_VALUE = 2;
const PROPOSAL_FUNCTION = "changeWithdrawFeePercentage";
const PROPOSAL_DESCRIPTION = "Proposal #1. Change the withdrawal fee to 2%."

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
    },
    [MUMBAI_CHAIN_ID]: {
        name: "mumbai",
        blockConfirmations: BLOCK_CONFIRMATIONS,
        USDTContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        DAIContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
        WETHContractAddress: POLYGON_MAINNET_WETH_CONTRACT_ADDRESS,
        swapRouterContractAddress: POLYGON_MAINNET_SWAP_ROUTER_CONTRACT_ADDRESS,
        aaveWrappedTokenGatewayContractAddress: POLYGON_MAINNET_AAVE_WETH_GATEWAY_CONTRACT_ADDRESS,
        aavePoolAddressesProviderAddress: POLYGON_MAINNET_AAVE_POOL_ADDRESSES_PROVIDER_ADDRESS,
    },
    [MAINNET_CHAIN_ID]: {
        name: "mainnet",
        blockConfirmations: BLOCK_CONFIRMATIONS,
        USDTContractAddress: POLYGON_MAINNET_USDT_CONTRACT_ADDRESS,
        DAIContractAddress: POLYGON_MAINNET_DAI_CONTRACT_ADDRESS,
        WETHContractAddress: POLYGON_MAINNET_WETH_CONTRACT_ADDRESS,
        swapRouterContractAddress: POLYGON_MAINNET_SWAP_ROUTER_CONTRACT_ADDRESS,
        aaveWrappedTokenGatewayContractAddress: POLYGON_MAINNET_AAVE_WETH_GATEWAY_CONTRACT_ADDRESS,
        aavePoolAddressesProviderAddress: POLYGON_MAINNET_AAVE_POOL_ADDRESSES_PROVIDER_ADDRESS,
    },
}

const developmentChains = ["hardhat", "localhost"];
const proposalsFile = "proposals.json"

module.exports = {
    chainIds,
    networkConfig,
    developmentChains,
    proposalsFile,
    UNISWAP_POOL_FEE,
    WITHDRAW_FEE_PERCENTAGE,
    STAKING_TO_GOVERNANCE_PERCENTAGE,
    MIN_DELAY,
    QUORUM_PERCENTAGE,
    VOTING_PERIOD,
    VOTING_DELAY,
    ADDRESS_ZERO,
    PROPOSAL_NEW_STORE_VALUE,
    PROPOSAL_FUNCTION,
    PROPOSAL_DESCRIPTION,
}
