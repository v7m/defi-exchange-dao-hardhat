const chai = require("chai");
const expect = chai.expect;
const { network, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("DeFiExchange Unit Tests", () => {
        let ERC20TokenMockContractFactory, daiTokenMockContract, usdtTokenMockContract,
            deFiExchangeContract, deFiExchangeContractFactory;

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];

            ERC20TokenMockContractFactory = await ethers.getContractFactory("ERC20TokenMock");
            daiTokenMockContract = await smock.fake(ERC20TokenMockContractFactory);
            usdtTokenMockContract = await smock.fake(ERC20TokenMockContractFactory);

            daiTokenMockContract.allowance.returns(5);
            usdtTokenMockContract.allowance.returns(5);
            daiTokenMockContract.transferFrom.returns(true);
            usdtTokenMockContract.transferFrom.returns(true);
            daiTokenMockContract.transfer.returns(true);
            usdtTokenMockContract.transfer.returns(true);

            deFiExchangeContractFactory = await ethers.getContractFactory("DeFiExchange");
            deFiExchangeContract = await deFiExchangeContractFactory.deploy(
                daiTokenMockContract.address,
                usdtTokenMockContract.address
            );
            await deFiExchangeContract.deployed();
        });

        describe("depositETH", async () => {
            const amount = ethers.utils.parseEther("1.0"); 

            it("updates user's ETH balance", async () => {
                await deFiExchangeContract.depositETH({ value: amount });
                const totalBalance = await deFiExchangeContract.s_totalEthBalance(deployer.address);
                
                expect(totalBalance).to.eq(amount);
            });

            it("emits event ETHDeposited", async () => {
                expect(
                    await deFiExchangeContract.depositETH({ value: amount })
                ).to.emit("ETHDeposited");
            });
        });

        describe("depositDAI", function () {
            context("when depositer has sufficient balance", () => {
                const amount = 5; 

                it("updates user's DAI balance", async function() {
                    await deFiExchangeContract.depositDAI(amount);
                    
                    expect(
                        daiTokenMockContract.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address);
                    expect(
                        daiTokenMockContract.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address, amount);
                    
                    const totalBalance = await deFiExchangeContract.s_totalDaiBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event DAIDeposited", async function() {
                    expect(
                        await deFiExchangeContract.depositDAI(amount)
                    ).to.emit("DAIDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = 6; 

                it("reverts transaction", async function () {
                    await expect(
                        deFiExchangeContract.depositDAI(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositDAIBalance");
                });
            });
        });

        describe("depositUSDT", function () {
            context("when depositer has sufficient balance", () => {
                const amount = 5; 

                it("updates user's USDT balance", async function() {
                    await deFiExchangeContract.depositUSDT(amount);

                    expect(
                        usdtTokenMockContract.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address);
                    expect(
                        usdtTokenMockContract.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address, amount);

                    const totalBalance = await deFiExchangeContract.s_totalUsdtBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event USDTDeposited", async function() {
                    expect(
                        await deFiExchangeContract.depositUSDT(amount)
                    ).to.emit("USDTDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = 6; 

                it("reverts transaction", async function () {
                    await expect(
                        deFiExchangeContract.depositUSDT(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositUSDTBalance");
                });
            });
        });

        describe("withdrawETH", async () => {
            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseEther("1.0");

                beforeEach(async () => {
                    await deFiExchangeContract.depositETH({ value: amount });
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchangeContract.s_totalEthBalance(deployer.address);
                    const userBalanceBefore = await deployer.getBalance();
                    const txResponse = await deFiExchangeContract.withdrawETH();
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
                        await deFiExchangeContract.withdrawETH()
                    ).to.emit("ETHWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchangeContract.withdrawETH()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawETHBalance");
                });
            });
        });

        describe("withdrawDAI", async () => {
            context("when amount greater then 0", () => {
                const amount = 5;

                beforeEach(async () => {
                    await deFiExchangeContract.depositDAI(amount);
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchangeContract.s_totalDaiBalance(deployer.address);

                    expect(userAmountBefore.toString()).to.eq("5");

                    await deFiExchangeContract.withdrawDAI();

                    expect(
                        daiTokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, amount);

                    const userAmountAfter = await deFiExchangeContract.s_totalDaiBalance(deployer.address);

                    expect(userAmountAfter.toString()).to.eq("0");
                });

                it("emits event DAIWithdrawn", async function() {
                    expect(
                        await deFiExchangeContract.withdrawDAI()
                    ).to.emit("DAIWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchangeContract.withdrawDAI()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawDAIBalance");
                });
            });
        });

        describe("withdrawUSDT", async () => {
            context("when amount greater then 0", () => {
                const amount = 5;

                beforeEach(async () => {
                    await deFiExchangeContract.depositUSDT(amount);
                });

                it("withdraws amount", async function () {
                    const userAmountBefore = await deFiExchangeContract.s_totalUsdtBalance(deployer.address);

                    expect(userAmountBefore.toString()).to.eq("5");

                    await deFiExchangeContract.withdrawUSDT();

                    expect(
                        usdtTokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, amount);

                    const userAmountAfter = await deFiExchangeContract.s_totalUsdtBalance(deployer.address);

                    expect(userAmountAfter.toString()).to.eq("0");
                });

                it("emits event USDTWithdrawn", async function() {
                    expect(
                        await deFiExchangeContract.withdrawUSDT()
                    ).to.emit("USDTWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async function () {
                    await expect(
                        deFiExchangeContract.withdrawUSDT()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawUSDTBalance");
                });
            });
        });
    });
