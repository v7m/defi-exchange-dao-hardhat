const chai = require("chai");
const expect = chai.expect;
const { network, deployments, ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { developmentChains } = require("../../helper-hardhat-config");

chai.use(smock.matchers)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("DeFiExchange Unit Tests", () => {
        let accounts, deployer, user, DAITokenMockContractFactory, USDTTokenMockContractFactory, 
            DAITokenMockContract, USDTTokenMockContract, deFiExchangeContract, deFiExchangeContractFactory,
            governanceTokenContract, governanceTokenContractFactory, swapRouterMockFactory, swapRouterMockContract;

        const withdrawFeePercentage = 1;
        const stakingToGovernancePercentage = 100;
        const uniswapPoolFee = 3000;
        const amount = ethers.utils.parseUnits("100", 18);
        const swapAmount = ethers.utils.parseUnits("50", 18);
        const amountEth = ethers.utils.parseEther("100");

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1]

            await deployments.fixture(["mocks", "governance", "GovernorContract-setup"]);

            DAITokenMockContractFactory = await ethers.getContractFactory("DAITokenMock");
            USDTTokenMockContractFactory = await ethers.getContractFactory("USDTTokenMock");
            // WETHTokenMockContract = await ethers.getContractFactory("WETHTokenMock");
            governanceTokenContractFactory = await ethers.getContractFactory("GovernanceToken");
            aaveWrappedTokenGatewayMockFactory = await ethers.getContractFactory("WrappedTokenGatewayMock");
            aavePoolAddressesProviderMockFactory = await ethers.getContractFactory("PoolAddressesProviderMock");
            swapRouterMockFactory = await ethers.getContractFactory("SwapRouterMock");

            DAITokenMockContract = await smock.fake(DAITokenMockContractFactory);
            USDTTokenMockContract = await smock.fake(USDTTokenMockContractFactory);
            // WETHTokenMockContract = await smock.fake(WETHTokenMockContract);
            governanceTokenContract = await smock.fake(governanceTokenContractFactory);
            aaveWrappedTokenGatewayMockContract = await smock.fake(aaveWrappedTokenGatewayMockFactory);
            aavePoolAddressesProviderMockContract = await smock.fake(aavePoolAddressesProviderMockFactory);
            swapRouterMockContract = await smock.fake(swapRouterMockFactory);

            DAITokenMockContract.allowance.returns(amount);
            USDTTokenMockContract.allowance.returns(amount);
            DAITokenMockContract.transferFrom.returns(true);
            USDTTokenMockContract.transferFrom.returns(true);
            DAITokenMockContract.transfer.returns(true);
            USDTTokenMockContract.transfer.returns(true);
            swapRouterMockContract.exactInputSingle.returns(swapAmount);

            WETHTokenMockContract = await ethers.getContract("WETHTokenMock");

            deFiExchangeContractFactory = await ethers.getContractFactory('DeFiExchange');

            deFiExchangeContract = await deFiExchangeContractFactory.deploy(
                DAITokenMockContract.address,
                USDTTokenMockContract.address,
                WETHTokenMockContract.address,
                governanceTokenContract.address,
                aaveWrappedTokenGatewayMockContract.address,
                aavePoolAddressesProviderMockContract.address,
                swapRouterMockContract.address,
                uniswapPoolFee,
                withdrawFeePercentage,
                stakingToGovernancePercentage
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

        describe("depositETHToAave", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
                await deFiExchangeContract.depositETH({ value: amountEth });
            });

            context("with enough ETH balance", () => {
                it("calls aaveWrappedTokenGatewayMockContract.depositETH function", async () => {
                    await deFiExchangeContract.depositETHToAave(amountEth);

                    expect(
                        aaveWrappedTokenGatewayMockContract.depositETH
                    ).to.have.been.calledOnce;
                });
            });

            it("updates ETH and WETH token balances", async () => {
                const userETHBalanceBefore = await deFiExchangeContract.getUserETHBalance(user.address);
                const userWETHBalanceBefore = await deFiExchangeContract.getUserWETHBalance(user.address);

                expect(userETHBalanceBefore).to.eq(amountEth);
                expect(userWETHBalanceBefore).to.eq(0);

                await deFiExchangeContract.depositETHToAave(amountEth);
                const userETHBalanceAfter = await deFiExchangeContract.getUserETHBalance(user.address);
                const userWETHBalanceAfter = await deFiExchangeContract.getUserWETHBalance(user.address);

                expect(userETHBalanceAfter).to.eq(0);
                expect(userWETHBalanceAfter).to.eq(amountEth);
            });

            it("emits ETHDepositedToAave", async () => {
                expect(
                    await deFiExchangeContract.depositETHToAave(amountEth)
                ).to.emit("ETHDepositedToAave");
            });

            context("without enough ETH balance", () => {
                const amount = ethers.utils.parseEther("101");

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.depositETHToAave(amount)
                    ).to.be.revertedWith("DeFiExchange__NotEnoughETHForDepositingToAave");
                });
            });
        });

        describe("performTokensSwap", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("with sufficient user balance", () => {
                beforeEach(async () => {
                    await deFiExchangeContract.depositDAI(swapAmount);
                });

                it("calls swapRouterMockContract.exactInputSingle function", async () => {
                    await deFiExchangeContract.performTokensSwap(
                        DAITokenMockContract.address,
                        USDTTokenMockContract.address,
                        swapAmount
                    );

                    expect(
                        swapRouterMockContract.exactInputSingle
                    ).to.have.been.calledOnce;
                });

                it("updates tokens balances", async () => {
                    const userDAIBalanceBefore = await deFiExchangeContract.getUserDAIBalance(user.address);
                    const userUSDTBalanceBefore = await deFiExchangeContract.getUserUSDTBalance(user.address);

                    expect(userDAIBalanceBefore).to.eq(swapAmount);
                    expect(userUSDTBalanceBefore).to.eq(0);

                    await deFiExchangeContract.performTokensSwap(
                        DAITokenMockContract.address,
                        USDTTokenMockContract.address,
                        swapAmount
                    );

                    const userDAIBalanceAfter = await deFiExchangeContract.getUserDAIBalance(user.address);
                    const userUSDTBalanceAfter = await deFiExchangeContract.getUserUSDTBalance(user.address);

                    expect(userDAIBalanceAfter).to.eq(0);
                    expect(userUSDTBalanceAfter).to.eq(swapAmount);
                });
            });

            context("with insufficient user balance", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.performTokensSwap(
                            DAITokenMockContract.address,
                            USDTTokenMockContract.address,
                            swapAmount
                        )
                    ).to.be.revertedWith("DeFiExchange__InsufficientSwapTokensBalance");
                });
            });
        });

        describe("stakeETHForGovernance", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when user sent ETH amount", async () => {
                const amount = ethers.utils.parseEther("100");

                it("updates staking amount", async () => {
                    await deFiExchangeContract.stakeETHForGovernance({ value: amount });
                    const stakingAmountAfter = await deFiExchangeContract.s_totalEthStaking(user.address);

                    expect(stakingAmountAfter).to.eq(amount);
                });

                it("mints governance tokens", async () => {
                    await deFiExchangeContract.stakeETHForGovernance({ value: amount });
                    const stakingAmountAfter = await deFiExchangeContract.s_totalEthStaking(user.address);
                    const governanceTokenAmount = stakingAmountAfter.mul(stakingToGovernancePercentage).div(100);

                    expect(
                        governanceTokenContract.mint
                    ).to.have.been.calledWith(user.address, governanceTokenAmount);
                });

                it("emits StakedETHForGovernance", async () => {
                    expect(
                        await deFiExchangeContract.stakeETHForGovernance({ value: amount })
                    ).to.emit("StakedETHForGovernance");
                });
            });

            context("when user sent 0 ETH amount", async () => {
                const amount = ethers.utils.parseEther("0");

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.stakeETHForGovernance({ value: amount })
                    ).to.be.revertedWith("DeFiExchange__NotEnoughETHForStaking");
                });
            });
        });

        describe("withdrawStakedETHForGovernance", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when ETH amount staked", async () => {
                const amount = ethers.utils.parseEther("100");

                beforeEach(async () => {
                    deFiExchangeContract.stakeETHForGovernance({ value: amount })
                });

                it("updates staking amount", async () => {
                    await deFiExchangeContract.withdrawStakedETHForGovernance();
                    const stakingAmountAfter = await deFiExchangeContract.s_totalEthStaking(user.address);

                    expect(stakingAmountAfter).to.eq(0);
                });

                it("burns governance tokens", async () => {
                    const stakingAmountBefore = await deFiExchangeContract.s_totalEthStaking(user.address);
                    await deFiExchangeContract.withdrawStakedETHForGovernance();
                    const governanceTokenAmount = stakingAmountBefore.mul(stakingToGovernancePercentage).div(100);

                    expect(
                        governanceTokenContract.burn
                    ).to.have.been.calledWith(user.address, governanceTokenAmount);
                });

                it("emits WithdrawStakedETHForGovernance", async () => {
                    expect(
                        await deFiExchangeContract.withdrawStakedETHForGovernance()
                    ).to.emit("WithdrawStakedETHForGovernance");
                });
            });

            context("when no ETH amount staked", async () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawStakedETHForGovernance()
                    ).to.be.revertedWith("DeFiExchange__ETHIsNotStaked");
                });
            });
        });

        describe("calculateGovernanceTokensAmount", async () => {
            const amount = ethers.utils.parseEther("100");
            const governanceTokenAmount = amount.mul(stakingToGovernancePercentage).div(100);

            it("returns correct governance tokens amount", async () => {
                const calculatedAmount =  await deFiExchangeContract.calculateGovernanceTokensAmount(amount);
                expect(calculatedAmount).to.eq(governanceTokenAmount);
            });
        });

        describe("depositETH", async () => {
            const amount = ethers.utils.parseEther("100");

            it("updates user's ETH balance", async () => {
                await deFiExchangeContract.depositETH({ value: amount });
                const totalBalance = await deFiExchangeContract.s_totalEthBalance(deployer.address);
                
                expect(totalBalance).to.eq(amount);
            });

            it("emits event TokenDeposited", async () => {
                expect(
                    await deFiExchangeContract.depositETH({ value: amount })
                ).to.emit("TokenDeposited");
            });
        });

        describe("depositDAI", () => {
            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's DAI balance", async () => {
                    await deFiExchangeContract.depositDAI(amount);
                    
                    expect(
                        DAITokenMockContract.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address);
                    expect(
                        DAITokenMockContract.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address, amount);
                    
                    const totalBalance = await deFiExchangeContract.getUserDAIBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event TokenDeposited", async () => {
                    expect(
                        await deFiExchangeContract.depositDAI(amount)
                    ).to.emit("TokenDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = ethers.utils.parseUnits("101", 18);

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.depositDAI(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositTokenBalance");
                });
            });
        });

        describe("depositUSDT", () => {
            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's USDT balance", async () => {
                    await deFiExchangeContract.depositUSDT(amount);

                    expect(
                        USDTTokenMockContract.allowance
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address);
                    expect(
                        USDTTokenMockContract.transferFrom
                    ).to.have.been.calledWith(deployer.address, deFiExchangeContract.address, amount);

                    const totalBalance = await deFiExchangeContract.getUserUSDTBalance(deployer.address);

                    expect(totalBalance).to.eq(amount);
                });

                it("emits event TokenDeposited", async () => {
                    expect(
                        await deFiExchangeContract.depositUSDT(amount)
                    ).to.emit("TokenDeposited");
                });
            });

            context("when depositer has insufficient balance", () => {
                const amount = ethers.utils.parseUnits("101", 18);

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.depositUSDT(amount)
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositTokenBalance");
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
                    const userAmountBefore = await deFiExchangeContract.getUserDAIBalance(deployer.address);

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawDAI();

                    expect(
                        DAITokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.getUserDAIBalance(deployer.address);

                    expect(userAmountAfter).to.eq(0);
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.getTotalDAIFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawDAI();
                    const feeAmountAfter = await deFiExchangeContract.getTotalDAIFees();

                    expect(feeAmountAfter).to.eq(feeAmount);
                });

                it("emits event TokenWithdrawn", async () => {
                    expect(
                        await deFiExchangeContract.withdrawDAI()
                    ).to.emit("TokenWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawDAI()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawTokenBalance");
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
                    const userAmountBefore = await deFiExchangeContract.getUserUSDTBalance(deployer.address);

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawUSDT();

                    expect(
                        USDTTokenMockContract.transfer
                    ).to.have.been.calledWith(deployer.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.getUserUSDTBalance(deployer.address);

                    expect(userAmountAfter).to.eq(0);
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.getTotalUSDTFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawUSDT();
                    const feeAmountAfter = await deFiExchangeContract.getTotalUSDTFees();

                    expect(feeAmountAfter).to.eq(feeAmount);
                });

                it("emits event TokenWithdrawn", async () => {
                    expect(
                        await deFiExchangeContract.withdrawUSDT()
                    ).to.emit("TokenWithdrawn");
                });
            });

            context("when amount is 0", () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.withdrawUSDT()
                    ).to.be.revertedWith("DeFiExchange__InsufficientWithdrawTokenBalance");
                });
            });
        });
    });
