const { network } = require("hardhat");
const { developmentChains, networkConfig, WITHDRAW_FEE_PERCENTAGE } = require("../helper-hardhat-config");
const { verifyContract } = require("../utils/verify-contract");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const waitBlockConfirmations = networkConfig[network.name]["blockConfirmations"] || 1;
    const args = [
        networkConfig[chainId]["daiContractAddress"],
        networkConfig[chainId]["usdtContractAddress"],
        WITHDRAW_FEE_PERCENTAGE,
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
