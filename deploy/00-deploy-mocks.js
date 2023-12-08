const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        log("----------------------------------------------------------");
        log("Deploying DAITokenMock to local network...");

        await deploy("DAITokenMock", {
            from: deployer,
            log: true,
            args: [],
        });

        log("DAITokenMock contract deployed!");
        log("Deploying USDTTokenMock to local network...");

        await deploy("USDTTokenMock", {
            from: deployer,
            log: true,
            args: [],
        });

        log("USDTTokenMock contract deployed!");
        log("Deploying SwapRouterMock to local network...");

        await deploy("SwapRouterMock", {
            from: deployer,
            log: true,
            args: [],
        });

        log("SwapRouterMock contract deployed!");
        log("----------------------------------------------------------");
    }
}
module.exports.tags = ["all", "mocks", "ERC20TokenMock"];
