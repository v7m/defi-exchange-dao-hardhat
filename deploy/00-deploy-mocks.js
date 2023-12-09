const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        const mockContracts = [
            "DAITokenMock",
            "USDTTokenMock",
            "WETHTokenMock",
            "SwapRouterMock",
            "WrappedTokenGatewayMock",
            "PoolAddressesProviderMock",
        ];

        log("----------------------------------------------------------");

        for (let i = 0; i < mockContracts.length; i++) {
            const contractName = mockContracts[i];
            log(`Deploying ${contractName} to local network...`);

            await deploy(contractName, {
                from: deployer,
                log: true,
                args: [],
            });

            log(`${contractName} contract deployed!`);
        }

        log("----------------------------------------------------------");
    }
}
module.exports.tags = ["all", "mocks", "ERC20TokenMock"];
