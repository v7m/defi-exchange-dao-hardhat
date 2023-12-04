const { network } = require("hardhat");
const { 
    developmentChains,
    MIN_DELAY,
    PROPOSAL_NEW_STORE_VALUE,
    PROPOSAL_FUNCTION,
    PROPOSAL_DESCRIPTION,
} = require("../helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");
const { moveTime } = require("../utils/move-time");

async function queueAndExecute() {
    const governorContract = await ethers.getContract("GovernorContract");
    const args = [PROPOSAL_NEW_STORE_VALUE];
    const functionToCall = PROPOSAL_FUNCTION;
    const deFiExchange = await ethers.getContract("DeFiExchange");
    const encodedFunctionCall = deFiExchange.interface.encodeFunctionData(
        functionToCall,
        args
    );
    const descriptionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    console.log("----------------------------------------------------------");
    console.log("Queueing function...");

    const queueTx = await governorContract.queue(
        [deFiExchange.address],
        [0],
        [encodedFunctionCall],
        descriptionHash
    );
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
        await moveTime(MIN_DELAY + 1);
        await moveBlocks(1);
    }

    console.log("Executing function...");
    // this will fail on a testnet because you need to wait for the MIN_DELAY!
    const executeTx = await governorContract.execute(
        [deFiExchange.address],
        [0],
        [encodedFunctionCall],
        descriptionHash
    );
    await executeTx.wait(1)

    console.log(`New DeFiExchange s_withdrawFeePercentage value: ${await deFiExchange.getWithdrawFeePercentage()}`)
    console.log("----------------------------------------------------------");
}

queueAndExecute()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    });
