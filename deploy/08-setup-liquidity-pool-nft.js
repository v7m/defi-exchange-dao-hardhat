const { ethers } = require("hardhat");
const { ADDRESS_ZERO } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const { deployer } = await getNamedAccounts();
    const liquidityPoolNFTContract = await ethers.getContract("LiquidityPoolNFT", deployer);
    const deFiExchangeContract = await ethers.getContractAt("DeFiExchange", deployer);

    log("----------------------------------------------------------");
    log("Setting up LiquidityPoolNFT contracts for roles...");

    const initializeTx = await liquidityPoolNFTContract.initialize(
        deFiExchangeContract.address
    );

    await initializeTx.wait(1);

    log("LiquidityPoolNFT contracts setup complete!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "main", "LiquidityPoolNFT-setup"];
