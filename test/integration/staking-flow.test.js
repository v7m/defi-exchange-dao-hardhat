const chai = require("chai");
const expect = chai.expect;
const { network, deployments, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Staking Flow Integration Tests", () => {
        let deFiExchangeContract, governanceTokenContract;
        const amount = ethers.utils.parseEther("100");

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1]

            await deployments.fixture(["mocks", "governance", "main", "GovernorContract-setup"]);

            deFiExchangeContract = await ethers.getContract("DeFiExchange");
            governanceTokenContract = await ethers.getContract("GovernanceToken");
            await governanceTokenContract.initialize(deFiExchangeContract.address);
            deFiExchangeContract = deFiExchangeContract.connect(user);
        });

        describe("stake ETH for Governance", async () => {
            it("stakes ETH amount and mints governance tokens", async () => {
                const stakingAmountBefore = await deFiExchangeContract.getUserEthStaked();
                const userGovernanceBefore = await governanceTokenContract.balanceOf(user.address);

                expect(stakingAmountBefore).to.eq(0);
                expect(userGovernanceBefore).to.equal(0);

                await deFiExchangeContract.stakeETHForGovernance({ value: amount });
                const stakingAmountAfter = await deFiExchangeContract.getUserEthStaked();
                const userGovernanceAfter = await governanceTokenContract.balanceOf(user.address);

                expect(stakingAmountAfter).to.eq(amount);
                expect(userGovernanceAfter).to.equal(amount);
            });
        });

        describe("withdraw staked ETH for Governance", async () => {
            beforeEach(async () => {
                await deFiExchangeContract.stakeETHForGovernance({ value: amount });
            });

            it("withdraws staked ETH amount and burns governance tokens", async () => {
                const stakingAmountBefore = await deFiExchangeContract.getUserEthStaked();
                const userGovernanceBefore = await governanceTokenContract.balanceOf(user.address);

                expect(stakingAmountBefore).to.eq(amount);
                expect(userGovernanceBefore).to.equal(amount);

                await deFiExchangeContract.withdrawStakedETHForGovernance();
                const stakingAmountAfter = await deFiExchangeContract.getUserEthStaked();
                const userGovernanceAfter = await governanceTokenContract.balanceOf(user.address);

                expect(stakingAmountAfter).to.eq(0);
                expect(userGovernanceAfter).to.equal(0);
            });
        });
    });
