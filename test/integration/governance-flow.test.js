const { network, deployments, ethers } = require("hardhat");
const { expect } = require("chai");
const { 
    developmentChains,
    PROPOSAL_NEW_STORE_VALUE,
    PROPOSAL_FUNCTION,
    PROPOSAL_DESCRIPTION,
    VOTING_PERIOD,
    VOTING_DELAY,
    MIN_DELAY,
} = require("../../helper-hardhat-config");
const { moveBlocks } = require("../../utils/move-blocks");
const { moveTime } = require("../../utils/move-time");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Governance Flow Integration Tests", async () => {
        let governorContractContract, deFiExchangeContract;

        const voteWay = 1;
        const reason = "I like it";

        beforeEach(async () => {
            await deployments.fixture(["all"]);
            governorContractContract = await ethers.getContract("GovernorContract");
            deFiExchangeContract = await ethers.getContract("DeFiExchange");
        });

        context("when DeFiExchange contract called not through governance", async () => {
            it("can only be changed through governance", async () => {
                await expect(
                    deFiExchangeContract.changeWithdrawFeePercentage(55)
                ).to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        it("proposes, votes, queues, and then executes DeFiExchange function through governance", async () => {
            // Creating a proposal
            const encodedFunctionCall = deFiExchangeContract.interface.encodeFunctionData(
                PROPOSAL_FUNCTION, 
                [PROPOSAL_NEW_STORE_VALUE]
            );
            const proposeTx = await governorContractContract.propose(
                [deFiExchangeContract.address],
                [0],
                [encodedFunctionCall],
                PROPOSAL_DESCRIPTION
            );
            const proposeReceipt = await proposeTx.wait(1);
            const proposalId = proposeReceipt.events[0].args.proposalId;
            let proposalState = await governorContractContract.state(proposalId);

            expect(proposalState.toString()).to.eq("0"); // 0: Pending

            await moveBlocks(VOTING_DELAY + 1);

            // Voting
            const voteTx = await governorContractContract.castVoteWithReason(proposalId, voteWay, reason);
            await voteTx.wait(1);
            proposalState = await governorContractContract.state(proposalId);

            expect(proposalState.toString()).to.eq("1"); // 1: Active

            await moveBlocks(VOTING_PERIOD + 1);
            proposalState = await governorContractContract.state(proposalId);

            expect(proposalState.toString()).to.eq("4"); // 4: Succeeded

            // Queuing
            // const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION));
            const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION);
            const queueTx = await governorContractContract.queue(
                [deFiExchangeContract.address],
                [0],
                [encodedFunctionCall],
                descriptionHash
            );
            await queueTx.wait(1);
            await moveTime(MIN_DELAY + 1);
            await moveBlocks(1);
            proposalState = await governorContractContract.state(proposalId);

            expect(proposalState.toString()).to.eq("5"); // 5: Queued

            // Executing
            const exTx = await governorContractContract.execute(
                [deFiExchangeContract.address],
                [0],
                [encodedFunctionCall],
                descriptionHash
            );
            await exTx.wait(1);
            proposalState = await governorContractContract.state(proposalId);

            expect(proposalState.toString()).to.eq("7"); // 7: Executed

            const withdrawFeePercentage =  await deFiExchangeContract.getWithdrawFeePercentage();

            expect(withdrawFeePercentage).to.eq(PROPOSAL_NEW_STORE_VALUE);
        });
    });
