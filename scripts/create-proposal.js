const { network } = require("hardhat");
const fs = require("fs");
const { 
    developmentChains, 
    proposalsFile,
    VOTING_DELAY,
    PROPOSAL_NEW_STORE_VALUE,
    PROPOSAL_FUNCTION,
    PROPOSAL_DESCRIPTION,
} = require("../helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");

async function createProposal() {
    const governorContract = await ethers.getContract("GovernorContract");
    const deFiExchange = await ethers.getContract("DeFiExchange");
    const args = [PROPOSAL_NEW_STORE_VALUE];
    const encodedFunctionCall = deFiExchange.interface.encodeFunctionData(
        PROPOSAL_FUNCTION,
        args
    );

    console.log("----------------------------------------------------------");
    console.log(`Proposing ${PROPOSAL_FUNCTION} on ${deFiExchange.address} with ${args}`);
    console.log(`Proposal Description:\n  ${PROPOSAL_DESCRIPTION}`);

    const proposeTx = await governorContract.propose(
        [deFiExchange.address],
        [0],
        [encodedFunctionCall],
        PROPOSAL_DESCRIPTION
    );
    // If development chain, move blocks till gets to the voting period.
    if (developmentChains.includes(network.name)) {
        await moveBlocks(VOTING_DELAY + 1);
    }

    const proposeReceipt = await proposeTx.wait(1);
    const proposalId = proposeReceipt.events[0].args.proposalId;

    console.log(`Proposed with proposal ID:\n  ${proposalId}`);

    const proposalState = await governorContract.state(proposalId);
    const proposalSnapShot = await governorContract.proposalSnapshot(proposalId);
    const proposalDeadline = await governorContract.proposalDeadline(proposalId);

    storeProposalId(proposalId);

    // the Proposal State is an enum data type, defined in the IGovernor contract.
    // 0: Pending, 1: Active, 2: Canceled, 3: Defeated, 4: Succeeded, 5: Queued, 6: Expired, 7: Executed
    console.log(`Current Proposal State: ${proposalState}`);
    // What block # the proposal was snapshot
    console.log(`Current Proposal Snapshot: ${proposalSnapShot}`);
    // The block number the proposal voting expires
    console.log(`Current Proposal Deadline: ${proposalDeadline}`);
    console.log("----------------------------------------------------------");
}

function storeProposalId(proposalId) {
    const chainId = network.config.chainId.toString();
    let proposals;

    if (fs.existsSync(proposalsFile)) {
        proposals = JSON.parse(fs.readFileSync(proposalsFile, "utf8"));
    } else {
        proposals = {};
        proposals[chainId] = [];
    }
    proposals[chainId].push(proposalId.toString());
    fs.writeFileSync(proposalsFile, JSON.stringify(proposals), "utf8");
}

createProposal()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    });
