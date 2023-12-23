const { ethers } = require("hardhat");
const { ADDRESS_ZERO } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const governanceTokenContractDeployment = await deployments.get("GovernanceToken");
    const deFiExchangeContractDeployment = await deployments.get("DeFiExchange");
    const governanceTokenContract = await ethers.getContractAt("GovernanceToken", governanceTokenContractDeployment.address);

    log("----------------------------------------------------------");
    log("Setting up GovernanceToken contracts for roles...");

    const initializeTx = await governanceTokenContract.initialize(
        deFiExchangeContractDeployment.address
    );

    await initializeTx.wait(1);

    log("GovernanceToken contracts setup complete!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "governance-setup", "GovernanceToken-setup"];
