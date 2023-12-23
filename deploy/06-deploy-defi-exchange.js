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
    const waitBlockConfirmations = networkConfig[chainId]["blockConfirmations"] || 1;
    let DAIContractAddress, USDTContractAddress, WETHContractAddress, aaveWrappedTokenGatewayContractAddress,
        uniswapSwapRouterContractAddress, aavePoolAddressesProviderContractAddress, aaveOraclePoolContractAddress;

    let DAITokenMockContractDeployment, USDTTokenMockContractDeployment, WETHTokenMockContractDeployment,
        uniswapSwapRouterMockContractDeployment, aaveWrappedTokenGatewayMockContractDeployment,
        aavePoolAddressesProviderMockContractDeployment, aaveOraclePoolContractDeployment;

    if (developmentChains.includes(network.name)) {
        DAITokenMockContractDeployment = await deployments.get("DAITokenMock");
        USDTTokenMockContractDeployment = await deployments.get("USDTTokenMock");
        WETHTokenMockContractDeployment = await deployments.get("WETHTokenMock");
        uniswapSwapRouterMockContractDeployment = await deployments.get("SwapRouterMock");
        aaveWrappedTokenGatewayMockContractDeployment = await deployments.get("WrappedTokenGatewayMock");
        aavePoolAddressesProviderMockContractDeployment = await deployments.get("PoolAddressesProviderMock");
        aaveOraclePoolContractDeployment = await deployments.get("AaveOracleMock");
        DAIContractAddress = DAITokenMockContractDeployment.address;
        USDTContractAddress = USDTTokenMockContractDeployment.address;
        WETHContractAddress = WETHTokenMockContractDeployment.address;
        uniswapSwapRouterContractAddress = uniswapSwapRouterMockContractDeployment.address;
        aaveWrappedTokenGatewayContractAddress = aaveWrappedTokenGatewayMockContractDeployment.address;
        aavePoolAddressesProviderContractAddress = aavePoolAddressesProviderMockContractDeployment.address;
        aaveOraclePoolContractAddress = aaveOraclePoolContractDeployment.address;
    } else {
        DAIContractAddress = networkConfig[chainId]["DAIContractAddress"];
        USDTContractAddress = networkConfig[chainId]["USDTContractAddress"];
        WETHContractAddress = networkConfig[chainId]["WETHContractAddress"];
        uniswapSwapRouterContractAddress = networkConfig[chainId]["uniswapSwapRouterContractAddress"];
        aaveWrappedTokenGatewayContractAddress = networkConfig[chainId]["aaveWrappedTokenGatewayContractAddress"];
        aavePoolAddressesProviderContractAddress = networkConfig[chainId]["aavePoolAddressesProviderAddress"];
        aaveOraclePoolContractAddress = networkConfig[chainId]["aaveOracleAddress"];
    }

    governanceTokenContractDeployment = await deployments.get("GovernanceToken");
    liquidityPoolNFTContractDeployment = await deployments.get("LiquidityPoolNFT");

    const contractAddresses = [
        DAIContractAddress,
        USDTContractAddress,
        WETHContractAddress,
        liquidityPoolNFTContractDeployment.address,
        governanceTokenContractDeployment.address,
        aaveWrappedTokenGatewayContractAddress,
        aavePoolAddressesProviderContractAddress,
        aaveOraclePoolContractAddress,
        uniswapSwapRouterContractAddress,
    ];

    const initializeArgs = [
        contractAddresses,
        UNISWAP_POOL_FEE,
        WITHDRAW_FEE_PERCENTAGE,
        STAKING_TO_GOVERNANCE_PERCENTAGE,
        deployer,
    ];

    log("----------------------------------------------------------");
    log("Deploying DeFiExchange contract...");

    const deploymentDeFiExchangeContract = await deploy("DeFiExchange", {
        from: deployer,
        log: true,
        waitConfirmations: waitBlockConfirmations,
        proxy: {
            proxyContract: 'OpenZeppelinTransparentProxy',
            viaAdminContract: {
                name: 'DiFiExchangeProxyAdmin',
                artifact: 'DiFiExchangeProxyAdmin',
            },
            execute: {
                methodName: "initialize",
                args: initializeArgs,
            },
        },
    });

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log("DeFiExchange contract verifying...");
        const deFiExchangeImplementationContractDeployment = await deployments.get("DeFiExchange_Implementation");
        await verifyContract(deFiExchangeImplementationContractDeployment.address, args);
    }

    log("DeFiExchange contract deployed!");
    log("Transferring ownership of DeFiExchange contract to TimeLock contact...");

    const deFiExchangeContract = await ethers.getContractAt("DeFiExchange", deploymentDeFiExchangeContract.address);
    const timeLockDeployment = await deployments.get("TimeLock");
    const transferTx = await deFiExchangeContract.transferOwnership(timeLockDeployment.address);
    await transferTx.wait(1);

    log("Transferring ownership finished!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "main", "DeFiExchange"];
