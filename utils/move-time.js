const { network } = require("hardhat");

const moveTime = async (time) => {
    console.log("Moving time...");
    await network.provider.send("evm_increaseTime", [time]);

    console.log(`Moved forward in time ${time} seconds`);
}

module.exports = {
    moveTime,
}
