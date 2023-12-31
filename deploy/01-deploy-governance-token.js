const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[chainId]["blockConfirmations"] || 1;

    log("----------------------------------------------------------");
    log("Deploying GovernanceToken contract...");

    const governanceToken = await deploy("GovernanceToken", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log("Verifying GovernanceToken contract...");
        await verifyContract(governanceToken.address, []);
    }

    log("GovernanceToken contract deployed!");
    log("Delegating GovernanceToken contract to deployer...");

    await delegate(governanceToken.address, deployer);

    log("GovernanceToken contract delegated to deployer!");
    log("----------------------------------------------------------");
}

const delegate = async (governanceTokenAddress, delegatedAccount) => {
    const governanceToken = await ethers.getContractAt("GovernanceToken", governanceTokenAddress);
    const transactionResponse = await governanceToken.delegate(delegatedAccount);
    await transactionResponse.wait(1);
    console.log(`Checkpoints: ${await governanceToken.numCheckpoints(delegatedAccount)}`)
}

module.exports.tags = ["all", "governance", "GovernanceToken"];
