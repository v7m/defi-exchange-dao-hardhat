const chai = require("chai");
const expect = chai.expect;
const { network, deployments, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("GovernanceToken Unit Tests", () => {
        let deFiExchangeContract, governanceTokenContract;
        const amount = ethers.utils.parseUnits("100", 18);

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1]

            await deployments.fixture(["mocks", "governance", "GovernorContract-setup", "main"]);

            deFiExchangeContract = await ethers.getContract("DeFiExchange");
            governanceTokenContract = await ethers.getContract("GovernanceToken");
        });

        describe("initialize", async () => {
            context("when stakingContractAddress already set", async () => {
                beforeEach(async () => {
                    await governanceTokenContract.initialize(deFiExchangeContract.address);
                });

                it("reverts transaction", async () => {
                    await expect(
                        governanceTokenContract.initialize(deFiExchangeContract.address)
                    ).to.be.revertedWith("GovernanceToken__StakingContractAlreadySet");
                });
            });

            context("when stakingContractAddress doesn't set", async () => {
                it("sets s_stakingContractAddress", async () => {
                    await governanceTokenContract.initialize(deFiExchangeContract.address);
                    const stakingContractAddress = await governanceTokenContract.s_stakingContractAddress();
                    
                    expect(stakingContractAddress).to.equal(deFiExchangeContract.address);
                });

                it("emits StakingContractSet", async () => {
                    expect(
                        await governanceTokenContract.initialize(deFiExchangeContract.address)
                    ).to.emit("StakedETHForGovernance");
                });
            });
        });

        describe("mint", async () => {
            const amount = ethers.utils.parseUnits("100", 18);

            context("when called by staking contract", () => {
                beforeEach(async () => {
                    // pretend that staking contract is deployer
                    await governanceTokenContract.initialize(deployer.address);
                });

                it("mints tokens", async () => {
                    const userGovernanceBefore = await governanceTokenContract.balanceOf(user.address);
                    expect(userGovernanceBefore).to.equal(0);

                    await governanceTokenContract.mint(user.address, amount);
                    const userGovernanceAfter = await governanceTokenContract.balanceOf(user.address);
                    expect(userGovernanceAfter).to.equal(amount);
                });

                it("emits GovernanceTokensMinted", async () => {
                    expect(
                        await governanceTokenContract.mint(user.address, amount)
                    ).to.emit("GovernanceTokensMinted");
                });
            });

            context("when called not by staking contract", () => {
                beforeEach(async () => {
                    // pretend that staking contract is user
                    await governanceTokenContract.initialize(user.address);
                });

                it("reverts transaction", async () => {
                    await expect(
                        governanceTokenContract.mint(user.address, amount)
                    ).to.be.revertedWith("GovernanceToken__AllowedOnlyForSkatingContract");
                });
            });
        });

        describe("burn", async () => {
            const amount = ethers.utils.parseUnits("100", 18);

            context("when called by staking contract", () => {
                beforeEach(async () => {
                    // pretend that staking contract is deployer
                    await governanceTokenContract.initialize(deployer.address);
                    await governanceTokenContract.mint(user.address, amount);
                });

                it("burns tokens", async () => {
                    const userGovernanceBefore = await governanceTokenContract.balanceOf(user.address);
                    expect(userGovernanceBefore).to.equal(amount);

                    await governanceTokenContract.burn(user.address, amount);
                    const userGovernanceAfter = await governanceTokenContract.balanceOf(user.address);
                    expect(userGovernanceAfter).to.equal(0);
                });

                it("emits GovernanceTokensBurned", async () => {
                    expect(
                        await governanceTokenContract.burn(user.address, amount)
                    ).to.emit("GovernanceTokensBurned");
                });
            });

            context("when called not by staking contract", () => {
                beforeEach(async () => {
                    // pretend that staking contract is user
                    await governanceTokenContract.initialize(user.address);
                });

                it("reverts transaction", async () => {
                    await expect(
                        governanceTokenContract.mint(user.address, amount)
                    ).to.be.revertedWith("GovernanceToken__AllowedOnlyForSkatingContract");
                });
            });
        });
    });
