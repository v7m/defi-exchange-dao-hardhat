const { network } = require("hardhat");
const { developmentChains, networkConfig, MIN_DELAY } = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[chainId]["blockConfirmations"] || 1;
    const args = [MIN_DELAY, [], [], deployer];

    log("----------------------------------------------------------");
    log("Deploying TimeLock contract...");

    const timeLock = await deploy("TimeLock", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log("Verifying TimeLock contract...");
        await verifyContract(timeLock.address, args)
    }

    log("TimeLock contract deployed!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "governance", "TimeLock"];
