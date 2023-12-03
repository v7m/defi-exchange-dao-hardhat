const { network } = require("hardhat");
const { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;
    const arguments = [
        networkConfig[chainId]["daiContractAddress"],
        networkConfig[chainId]["usdtContractAddress"],
        networkConfig[chainId]["withdrawFeePercentage"],
    ];
    const deFiExchange = await deploy("DeFiExchange", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("DeFiExchange contract verifying...");
        await verifyContract(deFiExchange.address, arguments);
    }

    log("----------------------------------------------------------");
    log("DeFiExchange contract deployed!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "deFiExchange", "main"];
