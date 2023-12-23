const { ethers } = require("hardhat");
const { ADDRESS_ZERO } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments;
    const { deployer } = await getNamedAccounts();
    const liquidityPoolNFTContractDeployment = await deployments.get("LiquidityPoolNFT", deployer);
    const deFiExchangeContractDeployment = await deployments.get("DeFiExchange", deployer);
    const liquidityPoolNFTContract = await ethers.getContractAt("LiquidityPoolNFT", liquidityPoolNFTContractDeployment.address);

    log("----------------------------------------------------------");
    log("Setting up LiquidityPoolNFT contracts for roles...");

    const initializeTx = await liquidityPoolNFTContract.initialize(
        deFiExchangeContractDeployment.address
    );

    await initializeTx.wait(1);

    log("LiquidityPoolNFT contracts setup complete!");
    log("----------------------------------------------------------");
}

module.exports.tags = ["all", "main", "LiquidityPoolNFT-setup"];
