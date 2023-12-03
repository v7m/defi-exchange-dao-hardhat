const { network } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    if (chainId == 31337) {
        log("Local network detected! Deploying mocks...");
        await deploy("ERC20TokenMock", {
            from: deployer,
            log: true,
            args: [],
        });

        log("----------------------------------------------------------");
        log("Mocks Deployed!");
        log("----------------------------------------------------------");
    }
}
module.exports.tags = ["all", "mocks", "main"];
