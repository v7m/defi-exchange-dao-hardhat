const { network } = require("hardhat");

const moveBlocks = async (blockNumber) => {
    console.log("Moving blocks...");
    for (let index = 0; index < blockNumber; index++) {
        await network.provider.request({
            method: "evm_mine",
            params: [],
        });
    }
    console.log(`Moved ${blockNumber} blocks`);
}

module.exports = {
    moveBlocks,
}
