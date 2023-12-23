const { ethers } = require("hardhat");
const { ADDRESS_ZERO } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const { deployer } = await getNamedAccounts();
    const timeLockContractDeployment = await deployments.get('TimeLock');
    const governorContractDeployment = await deployments.get('GovernorContract');
    const timeLockContract = await ethers.getContractAt("TimeLock", timeLockContractDeployment.address);

    log("----------------------------------------------------------");
    log("Setting up governance contracts for roles...");

    const proposerRole = await timeLockContract.PROPOSER_ROLE();
    const executorRole = await timeLockContract.EXECUTOR_ROLE();
    const adminRole = await timeLockContract.TIMELOCK_ADMIN_ROLE();

    const proposerTx = await timeLockContract.grantRole(proposerRole, governorContractDeployment.address);
    await proposerTx.wait(1);
    const executorTx = await timeLockContract.grantRole(executorRole, ADDRESS_ZERO);
    await executorTx.wait(1);
    const revokeTx = await timeLockContract.revokeRole(adminRole, deployer);
    await revokeTx.wait(1);

    log("Governance contracts setup complete!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "governance-setup", "GovernorContract-setup"];
