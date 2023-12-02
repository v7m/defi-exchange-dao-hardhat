const chai = require("chai");
const expect = chai.expect;
const { network, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("DeFi Exchange Unit Tests", () => {
        let IERC20Artifact, deFiExchange, deFiExchangeContract, daiTokenContractMock, usdtTokenContractMock;

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];

            IERC20Artifact = await hre.artifacts.readArtifact("IERC20");

            daiTokenContractMock = await smock.fake(IERC20Artifact.abi);
            usdtTokenContractMock = await smock.fake(IERC20Artifact.abi);

            daiTokenContractMock.allowance.returns(5);
            usdtTokenContractMock.allowance.returns(5);
            daiTokenContractMock.transferFrom.returns(true);
            usdtTokenContractMock.transferFrom.returns(true);
            daiTokenContractMock.transfer.returns(true);
            usdtTokenContractMock.transfer.returns(true);

            deFiExchangeContract = await ethers.getContractFactory("DeFiExchange");
            deFiExchange = await deFiExchangeContract.deploy(daiTokenContractMock.address, usdtTokenContractMock.address);
            await deFiExchange.deployed();
        });

        describe("depositETH", async () => {
            const amount = ethers.utils.parseEther("1.0"); 

            it("updates user's ETH balance", async () => {
                await deFiExchange.depositETH({ value: amount });
                const totalBalance = await deFiExchange.s_totalEthBalance(deployer.address);
                
                expect(totalBalance).to.eq(amount);
            });

            it("emits event ETHDeposited", async () => {
                expect(
                    await deFiExchange.depositETH({ value: amount })
                ).to.emit("ETHDeposited");
            });
        });

        describe("depositDAI", function () {
            context("when depositer has sufficient balance", () => {
                const amount = 5; 

                it("updates user's DAI balance", async function() {
                    await deFiExchange.depositDAI(amount);
                    
                    expect(
                        daiTokenContractMock.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchange.address);
                    expect(
                        daiTokenContractMock.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchange.address, amount);
                    
                    const totalBalance = await deFiExchange.s_totalDaiBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event DAIDeposited", async function() {
                    expect(
                        await deFiExchange.depositDAI(amount)
                    ).to.emit("DAIDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = 6; 

                it("reverts transaction", async function () {
                    await expect(
                        deFiExchange.depositDAI(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositDAIBalance");
                });
            });
        });

        describe("depositUSDT", function () {
            context("when depositer has sufficient balance", () => {
                const amount = 5; 

                it("updates user's USDT balance", async function() {
                    await deFiExchange.depositUSDT(amount);

                    expect(
                        usdtTokenContractMock.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchange.address);
                    expect(
                        usdtTokenContractMock.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchange.address, amount);

                    const totalBalance = await deFiExchange.s_totalUsdtBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event USDTDeposited", async function() {
                    expect(
                        await deFiExchange.depositUSDT(amount)
                    ).to.emit("USDTDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = 6; 

                it("reverts transaction", async function () {
                    await expect(
                        deFiExchange.depositUSDT(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositUSDTBalance");
                });
            });
        });

        describe("withdrawETH", async () => {
            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseEther("1.0");

                beforeEach(async () => {
                    await deFiExchange.depositETH({ value: amount });
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchange.s_totalEthBalance(deployer.address);
                    const userBalanceBefore = await deployer.getBalance();
                    const txResponse = await deFiExchange.withdrawETH();
                    const transactionReceipt = await txResponse.wait(1);
                    const { gasUsed, effectiveGasPrice } = transactionReceipt;
                    const gasCost = gasUsed.mul(effectiveGasPrice);
                    const userBalanceAfter = await deployer.getBalance();

                    expect(
                        userBalanceAfter.add(gasCost).toString()
                    ).to.eq(userAmountBefore.add(userBalanceBefore).toString());
                });

                it("emits event ETHWithdrawn", async function() {
                    expect(
                        await deFiExchange.withdrawETH()
                    ).to.emit("ETHWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchange.withdrawETH()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawETHBalance");
                });
            });
        });

        describe("withdrawDAI", async () => {
            context("when amount greater then 0", () => {
                const amount = 5;

                beforeEach(async () => {
                    await deFiExchange.depositDAI(amount);
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchange.s_totalDaiBalance(deployer.address);

                    expect(userAmountBefore.toString()).to.eq("5");

                    await deFiExchange.withdrawDAI();

                    expect(
                        daiTokenContractMock.transfer
                    ).to.have.been.calledWith(deployer.address, amount);

                    const userAmountAfter = await deFiExchange.s_totalDaiBalance(deployer.address);

                    expect(userAmountAfter.toString()).to.eq("0");
                });

                it("emits event DAIWithdrawn", async function() {
                    expect(
                        await deFiExchange.withdrawDAI()
                    ).to.emit("DAIWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchange.withdrawDAI()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawDAIBalance");
                });
            });
        });

        describe("withdrawUSDT", async () => {
            context("when amount greater then 0", () => {
                const amount = 5;

                beforeEach(async () => {
                    await deFiExchange.depositUSDT(amount);
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchange.s_totalUsdtBalance(deployer.address);

                    expect(userAmountBefore.toString()).to.eq("5");

                    await deFiExchange.withdrawUSDT();

                    expect(
                        usdtTokenContractMock.transfer
                    ).to.have.been.calledWith(deployer.address, amount);

                    const userAmountAfter = await deFiExchange.s_totalUsdtBalance(deployer.address);

                    expect(userAmountAfter.toString()).to.eq("0");
                });

                it("emits event USDTWithdrawn", async function() {
                    expect(
                        await deFiExchange.withdrawUSDT()
                    ).to.emit("USDTWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchange.withdrawUSDT()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawUSDTBalance");
                });
            });
        });
    });
