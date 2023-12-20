const { expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("LiquidityPoolNFT Unit Tests", function () {
        let liquidityPoolNFTContract,deFiExchangeContract, deployer, user;

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1];
            await deployments.fixture(["mocks", "governance", "governance-setup", "LiquidityPoolNFT", "DeFiExchange"]);
            liquidityPoolNFTContract = await ethers.getContract("LiquidityPoolNFT");
            deFiExchangeContract = await ethers.getContract("DeFiExchange");
        });

        describe("initialize", () => {
            context('when liquidity pool contract address already set', async () => {
                beforeEach(async () => {
                    await liquidityPoolNFTContract.initialize(deFiExchangeContract.address);
                });

                it("reverts transaction", async () => {
                    await expect(
                        liquidityPoolNFTContract.initialize(deFiExchangeContract.address)
                    ).to.be.revertedWith("LiquidityPoolNFT__LiquidityPoolContractAlreadySet");
                });
            });

            context('when liquidity pool contract address is not set', async () => {
                it("initializes the NFT contract correctly", async () => {
                    await liquidityPoolNFTContract.initialize(deFiExchangeContract.address);
                    const liquidityPoolContractAddress = await liquidityPoolNFTContract.getLiquidityPoolContractAddress();
    
                    expect(liquidityPoolContractAddress).to.eq(deFiExchangeContract.address);
                });
            });
        });

        describe("mintNFT", () => {
            context("when called by liquidity pool contract", () => {
                beforeEach(async () => {
                    // pretend that liquidity pool contract is deployer
                    await liquidityPoolNFTContract.initialize(deployer.address);
                });

                context("with valid amount parameters", () => {
                    const usdtAmount = ethers.utils.parseUnits("100", 18);
                    const daiAmount = ethers.utils.parseUnits("100", 18);
                    const ethAmount = ethers.utils.parseEther("100");

                    it("mints an NFT", async function () {
                        await liquidityPoolNFTContract.mintNFT(user.address, ethAmount, daiAmount, usdtAmount);
                        const tokenCounter = await liquidityPoolNFTContract.getTokenCounter();
    
                        expect(tokenCounter.toString()).to.eq("1");
                    });

                    it("returns correct balance of an NFT", async function () {
                        await liquidityPoolNFTContract.mintNFT(user.address, ethAmount, daiAmount, usdtAmount);
                        const userAddress = user.address;
                        const userBalances = await liquidityPoolNFTContract.balanceOf(userAddress);
                        const owner = await liquidityPoolNFTContract.ownerOf("0");

                        expect(owner).to.eq(userAddress);
                        expect(userBalances.toString()).to.eq("1");
                    });

                    it("emits NFTMinted event", async () => {
                        expect(
                            await liquidityPoolNFTContract.mintNFT(user.address, ethAmount, daiAmount, usdtAmount)
                        ).to.emit("NFTMinted");
                    });
                });

                context("with invalid amount parameters", () => {
                    it("reverts transaction", async () => { 
                        await expect(
                            liquidityPoolNFTContract.mintNFT(user.address, 0, 0, 0)
                        ).to.be.revertedWith("LiquidityPoolNFT__InvalidAmountForForMintingNFT");
                    });
                });
            });

            context("when called not by liquidity pool contract", () => {
                beforeEach(async () => {
                    // pretend that liquidity pool contract is user
                    await liquidityPoolNFTContract.initialize(user.address);
                });

                it("reverts transaction", async () => { 
                    await expect(
                        liquidityPoolNFTContract.mintNFT(user.address, 0, 0, 0)
                    ).to.be.revertedWith("LiquidityPoolNFT__AllowedOnlyForLiquidityPoolContract");
                });
            });
        });

        describe("burnNFT", () => {
            const usdtAmount = ethers.utils.parseUnits("100", 18);
            const daiAmount = ethers.utils.parseUnits("100", 18);
            const ethAmount = ethers.utils.parseEther("100");

            context("when called by liquidity pool contract", () => {
                beforeEach(async () => {
                    // pretend that liquidity pool contract is deployer
                    await liquidityPoolNFTContract.initialize(deployer.address);
                    await liquidityPoolNFTContract.mintNFT(user.address, ethAmount, daiAmount, usdtAmount);
                });

                context("when user in NFT owner", () => {
                    it("burns an NFT and returns correct balance of an NFT", async function () {
                        await liquidityPoolNFTContract.burnNFT(user.address, "0");
                        const userAddress = user.address;
                        const userBalances = await liquidityPoolNFTContract.balanceOf(userAddress);

                        expect(userBalances.toString()).to.eq("0");
                    });

                    it("emits NFTBurned event", async () => {
                        expect(
                            await liquidityPoolNFTContract.burnNFT(user.address, "0")
                        ).to.emit("NFTBurned");
                    });
                });

                context("when user is not NFT owner", () => {
                    it("reverts transaction", async () => { 
                        await expect(
                            liquidityPoolNFTContract.burnNFT(deployer.address, "0")
                        ).to.be.revertedWith("LiquidityPoolNFT__BurnCallerIsNotOwnerApprovedOrOperator");
                    });
                });
            });

            context("when called not by liquidity pool contract", () => {
                beforeEach(async () => {
                    // pretend that liquidity pool contract is user
                    await liquidityPoolNFTContract.initialize(user.address);
                });

                it("reverts transaction", async () => { 
                    await expect(
                        liquidityPoolNFTContract.burnNFT(user.address, "1")
                    ).to.be.revertedWith("LiquidityPoolNFT__AllowedOnlyForLiquidityPoolContract");
                });
            });
        });
    });
