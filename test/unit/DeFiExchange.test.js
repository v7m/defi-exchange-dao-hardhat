const chai = require("chai");
const expect = chai.expect;
const { network, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("DeFiExchange Unit Tests", () => {
        let accounts, deployer, user, ERC20TokenMockContractFactory, daiTokenMockContract, usdtTokenMockContract,
            deFiExchangeContract, deFiExchangeContractFactory;

        const tokenAmount = ethers.utils.parseUnits("100", 18);

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1]

            ERC20TokenMockContractFactory = await ethers.getContractFactory("ERC20TokenMock");
            daiTokenMockContract = await smock.fake(ERC20TokenMockContractFactory);
            usdtTokenMockContract = await smock.fake(ERC20TokenMockContractFactory);

            daiTokenMockContract.allowance.returns(tokenAmount);
            usdtTokenMockContract.allowance.returns(tokenAmount);
            daiTokenMockContract.transferFrom.returns(true);
            usdtTokenMockContract.transferFrom.returns(true);
            daiTokenMockContract.transfer.returns(true);
            usdtTokenMockContract.transfer.returns(true);

            const withdrawFeePercentage = 1;

            deFiExchangeContractFactory = await ethers.getContractFactory("DeFiExchange");
            deFiExchangeContract = await deFiExchangeContractFactory.deploy(
                daiTokenMockContract.address,
                usdtTokenMockContract.address,
                withdrawFeePercentage
            );
            await deFiExchangeContract.deployed();
        });

        describe("changeWithdrawFeePercentage", async () => {
            context("when caller is contract owner", () => {
                context("when new value is less then 100", () => {
                    const withdrawFeePercentage = 99;

                    it("updates s_withdrawFeePercentage", async () => {
                        await deFiExchangeContract.changeWithdrawFeePercentage(withdrawFeePercentage);
                        const withdrawFee = await deFiExchangeContract.s_withdrawFeePercentage();

                        expect(withdrawFee).to.eq(withdrawFeePercentage);
                    });

                    it("emits event WithdrawFeePercentageChanged", async () => {
                        expect(
                            await deFiExchangeContract.changeWithdrawFeePercentage(withdrawFeePercentage)
                        ).to.emit("WithdrawFeePercentageChanged");
                    });
                });

                context("when fee is greater then 100", () => {
                    const withdrawFeePercentage = 101;

                    it("reverts transaction", async () => {
                        await expect(
                            deFiExchangeContract.changeWithdrawFeePercentage(withdrawFeePercentage)
                        ).to.be.revertedWith("DeFiExchange__InvalidNewWithdrawFeePercentage");
                    });
                });
            });

            context("when caller is not contract owner", () => {
                const withdrawFeePercentage = 99;
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.connect(user).changeWithdrawFeePercentage(withdrawFeePercentage)
                    ).to.be.revertedWith("Ownable: caller is not the owner");
                });
            });
        });

        describe("depositETH", async () => {
            const amount = ethers.utils.parseEther("100");

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

        describe("depositDAI", () => {
            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's DAI balance", async () => {
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

                it("emits event DAIDeposited", async () => {
                    expect(
                        await deFiExchangeContract.depositDAI(amount)
                    ).to.emit("DAIDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = ethers.utils.parseUnits("101", 18);

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.depositDAI(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositDAIBalance");
                });
            });
        });

        describe("depositUSDT", () => {
            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's USDT balance", async () => {
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

                it("emits event USDTDeposited", async () => {
                    expect(
                        await deFiExchangeContract.depositUSDT(amount)
                    ).to.emit("USDTDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = ethers.utils.parseUnits("101", 18);

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.depositUSDT(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositUSDTBalance");
                });
            });
        });

        describe("withdrawETH", async () => {
            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseEther("100");
                const feeAmount = ethers.utils.parseEther("1");

                beforeEach(async () => {
                    await deFiExchangeContract.depositETH({ value: amount });
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.s_totalEthBalance(deployer.address);
                    const userBalanceBefore = await deployer.getBalance();
                    const txResponse = await deFiExchangeContract.withdrawETH();
                    const transactionReceipt = await txResponse.wait(1);
                    const { gasUsed, effectiveGasPrice } = transactionReceipt;
                    const gasCost = gasUsed.mul(effectiveGasPrice);
                    const userBalanceAfter = await deployer.getBalance();

                    expect(
                        userBalanceAfter.add(gasCost).add(feeAmount).toString()
                    ).to.eq(userAmountBefore.add(userBalanceBefore).toString());
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.s_totalEthFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawETH();
                    const feeAmountAfter = await deFiExchangeContract.s_totalEthFees();

                    expect(feeAmountAfter).to.eq(feeAmount);
                });

                it("emits event ETHWithdrawn", async () => {
                    expect(
                        await deFiExchangeContract.withdrawETH()
                    ).to.emit("ETHWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawETH()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawETHBalance");
                });
            });
        });

        describe("withdrawDAI", async () => {
            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseUnits("100", 18);
                const feeAmount = ethers.utils.parseUnits("1", 18);
                const withdrawAmount = ethers.utils.parseUnits("99", 18);

                beforeEach(async () => {
                    await deFiExchangeContract.depositDAI(amount);
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.s_totalDaiBalance(deployer.address);

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawDAI();

                    expect(
                        daiTokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.s_totalDaiBalance(deployer.address);

                    expect(userAmountAfter).to.eq(0);
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.s_totalDaiFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawDAI();
                    const feeAmountAfter = await deFiExchangeContract.s_totalDaiFees();

                    expect(feeAmountAfter).to.eq(feeAmount);
                });

                it("emits event DAIWithdrawn", async () => {
                    expect(
                        await deFiExchangeContract.withdrawDAI()
                    ).to.emit("DAIWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawDAI()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawDAIBalance");
                });
            });
        });

        describe("withdrawUSDT", async () => {
            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseUnits("100", 18);
                const feeAmount = ethers.utils.parseUnits("1", 18);
                const withdrawAmount = ethers.utils.parseUnits("99", 18);

                beforeEach(async () => {
                    await deFiExchangeContract.depositUSDT(amount);
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.s_totalUsdtBalance(deployer.address);

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawUSDT();

                    expect(
                        usdtTokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.s_totalUsdtBalance(deployer.address);

                    expect(userAmountAfter).to.eq(0);
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.s_totalUsdtFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawUSDT();
                    const feeAmountAfter = await deFiExchangeContract.s_totalUsdtFees();

                    expect(feeAmountAfter).to.eq(feeAmount);
                });

                it("emits event USDTWithdrawn", async () => {
                    expect(
                        await deFiExchangeContract.withdrawUSDT()
                    ).to.emit("USDTWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawUSDT()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawUSDTBalance");
                });
            });
        });
    });
