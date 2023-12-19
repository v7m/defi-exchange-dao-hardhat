const { network } = require("hardhat");
const { 
    developmentChains, 
    networkConfig,
    QUORUM_PERCENTAGE,
    VOTING_PERIOD,
    VOTING_DELAY,
} = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[chainId]["blockConfirmations"] || 1;
    const governanceToken = await get("GovernanceToken");
    const timeLock = await get("TimeLock");
    const args = [
        governanceToken.address,
        timeLock.address,
        QUORUM_PERCENTAGE,
        VOTING_PERIOD,
        VOTING_DELAY,
    ]
    
    log("----------------------------------------------------------");
    log("Deploying GovernorContract contract...");

    const governorContract = await deploy("GovernorContract", {
        from: deployer,
        args: args, 
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log("Verifying GovernorContract contract...");
        await verifyContract(governorContract.address, args);
    }

    log("GovernorContract contract deployed!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "governance", "GovernorContract"];
