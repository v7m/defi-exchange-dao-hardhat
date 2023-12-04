const { network, ethers } = require("hardhat");
const fs = require("fs");
const { 
    developmentChains, 
    proposalsFile,
    VOTING_PERIOD,
} = require("../helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");

async function voteForProposal() {
    const proposals = JSON.parse(fs.readFileSync(proposalsFile, "utf8"));
    const proposalId = proposals[network.config.chainId].at(-1); // last proposal for the network
    const voteWay = 1; // 0 = Against, 1 = For, 2 = Abstain
    const reason = "Good proposal!";
    await vote(proposalId, voteWay, reason);
}

async function vote(proposalId, voteWay, reason) {
    console.log("----------------------------------------------------------");
    console.log("Voting for proposal...");

    const governorContract = await ethers.getContract("GovernorContract");
    const voteTx = await governorContract.castVoteWithReason(proposalId, voteWay, reason);
    const voteTxReceipt = await voteTx.wait(1);

    console.log(`Current Proposal Reason: ${voteTxReceipt.events[0].args.reason}`);

    const proposalState = await governorContract.state(proposalId);

    console.log(`Current Proposal State: ${proposalState}`);

    if (developmentChains.includes(network.name)) {
        await moveBlocks(VOTING_PERIOD + 1);
    }

    console.log("Proposal has been voted on!");
    console.log("----------------------------------------------------------");
}

    voteForProposal()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        });
