const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        log("----------------------------------------------------------");
        log("Deploying ERC20TokenMock to local network...");

        await deploy("ERC20TokenMock", {
            from: deployer,
            log: true,
            args: [],
        });

        log("ERC20TokenMock contract deployed!");
        log("----------------------------------------------------------");
    }
}
module.exports.tags = ["all", "mocks", "ERC20TokenMock"];
