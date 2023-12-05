const { ethers } = require("hardhat");
const { ADDRESS_ZERO } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const { deployer } = await getNamedAccounts();
    const governanceTokenContract = await ethers.getContract("GovernanceToken", deployer);
    const deFiExchangeContract = await ethers.getContract("DeFiExchange");

    log("----------------------------------------------------------");
    log("Setting up GovernanceToken contracts for roles...");

    const initializeTx = await governanceTokenContract.initialize(
        deFiExchangeContract.address
    );

    await initializeTx.wait(1);

    log("GovernanceToken contracts setup complete!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "governance-setup", "GovernanceToken-setup"];
