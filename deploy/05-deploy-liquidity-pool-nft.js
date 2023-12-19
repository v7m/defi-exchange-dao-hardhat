const { network } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[chainId]["blockConfirmations"] || 1;

    log("----------------------------------------------------------");
    log("Deploying LiquidityPoolNFT contract...");

    const liquidityPoolNFT = await deploy("LiquidityPoolNFT", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log("Verifying LiquidityPoolNFT contract...");
        await verifyContract(liquidityPoolNFT.address, []);
    }

    log("LiquidityPoolNFT contract deployed!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "main", "LiquidityPoolNFT"];
