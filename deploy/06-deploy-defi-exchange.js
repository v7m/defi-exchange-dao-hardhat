const { network, ethers } = require("hardhat");
const {
    developmentChains,
    networkConfig,
    UNISWAP_POOL_FEE,
    WITHDRAW_FEE_PERCENTAGE,
    STAKING_TO_GOVERNANCE_PERCENTAGE,
} = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[network.name]["blockConfirmations"] || 1;
    let DAITokenMockContract, USDTTokenMockContract, governanceTokenContract, DAIContractAddress, USDTContractAddress,
        swapRouterContractAddress, swapRouterMockContract;

    if (developmentChains.includes(network.name)) {
        DAITokenMockContract = await ethers.getContract("DAITokenMock");
        USDTTokenMockContract = await ethers.getContract("USDTTokenMock");
        WETHTokenMockContract = await ethers.getContract("WETHTokenMock");
        swapRouterMockContract = await ethers.getContract("SwapRouterMock");
        aaveWrappedTokenGatewayMockContract = await ethers.getContract("WrappedTokenGatewayMock");
        aavePoolAddressesProviderMockContract = await ethers.getContract("PoolAddressesProviderMock");
        aaveOraclePoolContractAddress = await ethers.getContract("AaveOracleMock");
        DAIContractAddress = DAITokenMockContract.address;
        USDTContractAddress = USDTTokenMockContract.address;
        WETHContractAddress = WETHTokenMockContract.address;
        swapRouterContractAddress = swapRouterMockContract.address;
        aaveWrappedTokenGatewayContractAddress = aaveWrappedTokenGatewayMockContract.address;
        aavePoolAddressesProviderContractAddress = aavePoolAddressesProviderMockContract.address;
        aaveOraclePoolContractAddress = aaveOraclePoolContractAddress.address;
    } else {
        DAIContractAddress = networkConfig[chainId]["DAIContractAddress"];
        USDTContractAddress = networkConfig[chainId]["USDTContractAddress"];
        WETHContractAddress = networkConfig[chainId]["WETHContractAddress"];
        swapRouterContractAddress = networkConfig[chainId]["swapRouterContract"];
        aaveWrappedTokenGatewayContractAddress = networkConfig[chainId]["aaveWrappedTokenGatewayContractAddress"];
        aavePoolAddressesProviderContractAddress = networkConfig[chainId]["aavePoolAddressesProviderAddress"];
        aaveOraclePoolContractAddress = networkConfig[chainId]["aaveOracleAddress"];
    }

    governanceTokenContract = await ethers.getContract("GovernanceToken");
    liquidityPoolNFTContract = await ethers.getContract("LiquidityPoolNFT");

    const args = [
        DAIContractAddress,
        USDTContractAddress,
        WETHContractAddress,
        liquidityPoolNFTContract.address,
        governanceTokenContract.address,
        aaveWrappedTokenGatewayContractAddress,
        aavePoolAddressesProviderContractAddress,
        aaveOraclePoolContractAddress,
        swapRouterContractAddress,
        UNISWAP_POOL_FEE,
        WITHDRAW_FEE_PERCENTAGE,
        STAKING_TO_GOVERNANCE_PERCENTAGE,
    ];

    log("----------------------------------------------------------");
    log("Deploying DeFiExchange contract...");

    const deFiExchange = await deploy("DeFiExchange", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("DeFiExchange contract verifying...");
        await verifyContract(deFiExchange.address, args);
    }

    log("DeFiExchange contract deployed!");
    log("Transferring ownership of DeFiExchange contract to TimeLock contact...");

    const deFiExchangeContract = await ethers.getContractAt("DeFiExchange", deFiExchange.address);
    const timeLock = await ethers.getContract("TimeLock");
    const transferTx = await deFiExchangeContract.transferOwnership(timeLock.address);
    await transferTx.wait(1);

    log("Transferring ownership finished!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "main", "DeFiExchange"];
