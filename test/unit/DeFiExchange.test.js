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
        const nftTokenId = 1;
        const amount = ethers.utils.parseUnits("100", 18);
        const swapAmount = ethers.utils.parseUnits("50", 18);
        const ethAmount = ethers.utils.parseEther("100");

        beforeEach(async () => {
            accounts = await ethers.getSigners();
            deployer = accounts[0];
            user = accounts[1];

            await deployments.fixture(["mocks", "governance", "GovernorContract-setup"]);

            DAITokenMockContractFactory = await ethers.getContractFactory("DAITokenMock");
            USDTTokenMockContractFactory = await ethers.getContractFactory("USDTTokenMock");
            liquidityPoolNFTContractFactory = await ethers.getContractFactory("LiquidityPoolNFT");
            governanceTokenContractFactory = await ethers.getContractFactory("GovernanceToken");
            aaveWrappedTokenGatewayMockFactory = await ethers.getContractFactory("WrappedTokenGatewayMock");
            aavePoolAddressesProviderMockFactory = await ethers.getContractFactory("PoolAddressesProviderMock");
            aaveOracleContractFactory = await ethers.getContractFactory("AaveOracleMock");
            aavePoolMockContractFactory = await ethers.getContractFactory("PoolMock");
            swapRouterMockFactory = await ethers.getContractFactory("SwapRouterMock");
            WETHTokenMockContract = await ethers.getContract("WETHTokenMock");

            DAITokenMockContract = await smock.fake(DAITokenMockContractFactory);
            USDTTokenMockContract = await smock.fake(USDTTokenMockContractFactory);
            liquidityPoolNFTContract = await smock.fake(liquidityPoolNFTContractFactory);
            governanceTokenContract = await smock.fake(governanceTokenContractFactory);
            aaveWrappedTokenGatewayMockContract = await smock.fake(aaveWrappedTokenGatewayMockFactory);
            aavePoolAddressesProviderMockContract = await smock.fake(aavePoolAddressesProviderMockFactory);
            aaveOracleContract = await smock.fake(aaveOracleContractFactory);
            aavePoolMockContract = await smock.fake(aavePoolMockContractFactory);
            swapRouterMockContract = await smock.fake(swapRouterMockFactory);

            DAITokenMockContract.allowance.returns(amount);
            USDTTokenMockContract.allowance.returns(amount);
            DAITokenMockContract.transferFrom.returns(true);
            USDTTokenMockContract.transferFrom.returns(true);
            DAITokenMockContract.transfer.returns(true);
            USDTTokenMockContract.transfer.returns(true);
            swapRouterMockContract.exactInputSingle.returns(swapAmount);
            liquidityPoolNFTContract.mintNFT.returns(nftTokenId);
            liquidityPoolNFTContract.ownerOf.returns(user.address);
            aaveOracleContract.getAssetPrice.returns(1);
            aavePoolAddressesProviderMockContract.getPool.returns(aavePoolMockContract.address);
            aavePoolMockContract.borrow.returns();

            deFiExchangeContractFactory = await ethers.getContractFactory('DeFiExchange');

            const contractAddresses = [
                DAITokenMockContract.address,
                USDTTokenMockContract.address,
                WETHTokenMockContract.address,
                liquidityPoolNFTContract.address,
                governanceTokenContract.address,
                aaveWrappedTokenGatewayMockContract.address,
                aavePoolAddressesProviderMockContract.address,
                aaveOracleContract.address,
                swapRouterMockContract.address,
            ];

            deFiExchangeContract = await deFiExchangeContractFactory.deploy(
                contractAddresses,
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

        describe("provideLiquidity", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when amount of liquidity is invalid", () => {
                const daiAmount = 0;
                const usdtAmount = 0;
                const ethAmount = 0;

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount})
                    ).to.be.revertedWith("DeFiExchange__InvalidAmountForLiquidityProviding");
                });
            });

            context("when amount of liquidity is valid", () => {
                context("when not enough tokens on user balance", () => {
                    context("when not enough DAI on user balance", () => {
                        const usdtAmount = ethers.utils.parseUnits("100", 18);
                        const daiAmount = ethers.utils.parseUnits("101", 18);

                        it("reverts transaction", async () => {
                            await expect(
                                deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount})
                            ).to.be.revertedWith("DeFiExchange__InsufficientLiquidityProvidingTokenBalance");
                        });
                    });

                    context("when not enough USDT on user balance", () => {
                        const usdtAmount = ethers.utils.parseUnits("101", 18);
                        const daiAmount = ethers.utils.parseUnits("100", 18);

                        it("reverts transaction", async () => {
                            await expect(
                                deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount})
                            ).to.be.revertedWith("DeFiExchange__InsufficientLiquidityProvidingTokenBalance");
                        });
                    });
                });

                context("when enough tokens on user balance", () => {
                    const usdtAmount = ethers.utils.parseUnits("100", 18);
                    const daiAmount = ethers.utils.parseUnits("100", 18);

                    it("calls allowance and transferFrom function on token contracts", async () => {
                        await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount});

                        expect(
                            DAITokenMockContract.allowance
                        ).to.have.been.calledWith(user.address, deFiExchangeContract.address);
                        expect(
                            DAITokenMockContract.transferFrom
                        ).to.have.been.calledWith(user.address, deFiExchangeContract.address, amount);
                        expect(
                            USDTTokenMockContract.allowance
                        ).to.have.been.calledWith(user.address, deFiExchangeContract.address);
                        expect(
                            USDTTokenMockContract.transferFrom
                        ).to.have.been.calledWith(user.address, deFiExchangeContract.address, amount);
                    });

                    it("updates liquidity pool amounts", async () => {
                        const liquidityPoolETHAmountBefore = await deFiExchangeContract.getLiquidityPoolETHAmount();
                        const liquidityPoolDAIAmountBefore = await deFiExchangeContract.getLiquidityPoolDAIAmount();
                        const liquidityPoolUSDTAmountBefore = await deFiExchangeContract.getLiquidityPoolUSDTAmount();

                        expect(liquidityPoolETHAmountBefore).to.eq(0);
                        expect(liquidityPoolDAIAmountBefore).to.eq(0);
                        expect(liquidityPoolUSDTAmountBefore).to.eq(0);

                        await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount});
                        const liquidityPoolETHAmountAfter = await deFiExchangeContract.getLiquidityPoolETHAmount();
                        const liquidityPoolDAIAmountAfter = await deFiExchangeContract.getLiquidityPoolDAIAmount();
                        const liquidityPoolUSDTAmountAfter = await deFiExchangeContract.getLiquidityPoolUSDTAmount();

                        expect(liquidityPoolETHAmountAfter).to.eq(ethAmount);
                        expect(liquidityPoolDAIAmountAfter).to.eq(daiAmount);
                        expect(liquidityPoolUSDTAmountAfter).to.eq(usdtAmount);
                    });

                    it("calls mintNFT function on liquidity pool NFT contract", async () => {
                        await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount});

                        expect(
                            liquidityPoolNFTContract.mintNFT
                        ).to.have.been.calledWith(user.address, ethAmount, daiAmount, usdtAmount);
                    });

                    it("updates NFT user liquidity pool amounts", async () => {
                        const NFTUserETHLiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserETHLiquidityPoolAmount(nftTokenId);
                        const NFTUserDAILiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserDAILiquidityPoolAmount(nftTokenId);
                        const NFTUserUSDTLiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserUSDTLiquidityPoolAmount(nftTokenId);

                        expect(NFTUserETHLiquidityPoolAmountBefore).to.eq(0);
                        expect(NFTUserDAILiquidityPoolAmountBefore).to.eq(0);
                        expect(NFTUserUSDTLiquidityPoolAmountBefore).to.eq(0);

                        await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount});
                        const NFTUserETHLiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserETHLiquidityPoolAmount(nftTokenId);
                        const NFTUserDAILiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserDAILiquidityPoolAmount(nftTokenId);
                        const NFTUserUSDTLiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserUSDTLiquidityPoolAmount(nftTokenId);

                        expect(NFTUserETHLiquidityPoolAmountAfter).to.eq(ethAmount);
                        expect(NFTUserDAILiquidityPoolAmountAfter).to.eq(daiAmount);
                        expect(NFTUserUSDTLiquidityPoolAmountAfter).to.eq(usdtAmount);
                    });

                    it("emits LiquidityProvided event", async () => {
                        expect(
                            await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount})
                        ).to.emit("LiquidityProvided");
                    });
                });
            });
        });

        describe("redeemLiquidity", async () => {
            const usdtAmount = ethers.utils.parseUnits("100", 18);
            const daiAmount = ethers.utils.parseUnits("100", 18);

            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
                await deFiExchangeContract.provideLiquidity(usdtAmount, daiAmount, {value: ethAmount});
            });

            context("when user is not NFT owner", () => {
                beforeEach(async () => {
                    liquidityPoolNFTContract.ownerOf.returns(deployer.address);
                });

                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.redeemLiquidity(nftTokenId)
                    ).to.be.revertedWith("DeFiExchange__SenderIsNotOwnerOfNFT");
                });
            });

            context("when user is NFT owner", () => {
                it("withdraws ETH amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.getNFTUserETHLiquidityPoolAmount(nftTokenId);
                    const userBalanceBefore = await user.getBalance();
                    const txResponse = await deFiExchangeContract.redeemLiquidity(nftTokenId);
                    const transactionReceipt = await txResponse.wait(1);
                    const { gasUsed, effectiveGasPrice } = transactionReceipt;
                    const gasCost = gasUsed.mul(effectiveGasPrice);
                    const userBalanceAfter = await user.getBalance();

                    expect(
                        userBalanceAfter.add(gasCost).toString()
                    ).to.eq(userAmountBefore.add(userBalanceBefore).toString());
                });

                it("calls transfer function on token contracts", async () => {
                    await deFiExchangeContract.redeemLiquidity(nftTokenId);

                    expect(
                        DAITokenMockContract.transfer
                    ).to.have.been.calledWith(user.address, daiAmount);
                    expect(
                        USDTTokenMockContract.transfer
                    ).to.have.been.calledWith(user.address, usdtAmount);
                });

                it("updates liquidity pool amounts", async () => {
                    const liquidityPoolETHAmountBefore = await deFiExchangeContract.getLiquidityPoolETHAmount();
                    const liquidityPoolDAIAmountBefore = await deFiExchangeContract.getLiquidityPoolDAIAmount();
                    const liquidityPoolUSDTAmountBefore = await deFiExchangeContract.getLiquidityPoolUSDTAmount();

                    expect(liquidityPoolETHAmountBefore).to.eq(ethAmount);
                    expect(liquidityPoolDAIAmountBefore).to.eq(daiAmount);
                    expect(liquidityPoolUSDTAmountBefore).to.eq(usdtAmount);

                    await deFiExchangeContract.redeemLiquidity(nftTokenId);
                    const liquidityPoolETHAmountAfter = await deFiExchangeContract.getLiquidityPoolETHAmount();
                    const liquidityPoolDAIAmountAfter = await deFiExchangeContract.getLiquidityPoolDAIAmount();
                    const liquidityPoolUSDTAmountAfter = await deFiExchangeContract.getLiquidityPoolUSDTAmount();

                    expect(liquidityPoolETHAmountAfter).to.eq(0);
                    expect(liquidityPoolDAIAmountAfter).to.eq(0);
                    expect(liquidityPoolUSDTAmountAfter).to.eq(0);
                });

                it("calls burnNFT function on liquidity pool NFT contract", async () => {
                    await deFiExchangeContract.redeemLiquidity(nftTokenId);

                    expect(
                        liquidityPoolNFTContract.burnNFT
                    ).to.have.been.calledWith(user.address, nftTokenId);
                });

                it("updates NFT user liquidity pool amounts", async () => {
                    const NFTUserETHLiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserETHLiquidityPoolAmount(nftTokenId);
                    const NFTUserDAILiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserDAILiquidityPoolAmount(nftTokenId);
                    const NFTUserUSDTLiquidityPoolAmountBefore = await deFiExchangeContract.getNFTUserUSDTLiquidityPoolAmount(nftTokenId);

                    expect(NFTUserETHLiquidityPoolAmountBefore).to.eq(ethAmount);
                    expect(NFTUserDAILiquidityPoolAmountBefore).to.eq(daiAmount);
                    expect(NFTUserUSDTLiquidityPoolAmountBefore).to.eq(usdtAmount);

                    await deFiExchangeContract.redeemLiquidity(nftTokenId);
                    const NFTUserETHLiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserETHLiquidityPoolAmount(nftTokenId);
                    const NFTUserDAILiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserDAILiquidityPoolAmount(nftTokenId);
                    const NFTUserUSDTLiquidityPoolAmountAfter = await deFiExchangeContract.getNFTUserUSDTLiquidityPoolAmount(nftTokenId);

                    expect(NFTUserETHLiquidityPoolAmountAfter).to.eq(0);
                    expect(NFTUserDAILiquidityPoolAmountAfter).to.eq(0);
                    expect(NFTUserUSDTLiquidityPoolAmountAfter).to.eq(0);
                });

                it("emits LiquidityRedeemed event", async () => {
                    expect(
                        await deFiExchangeContract.redeemLiquidity(nftTokenId)
                    ).to.emit("LiquidityRedeemed");
                });
            });
        });

        describe("depositETHToAave", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
                await deFiExchangeContract.depositETH({ value: ethAmount });
            });

            context("with enough ETH balance", () => {
                it("calls aaveWrappedTokenGatewayMockContract.depositETH function", async () => {
                    await deFiExchangeContract.depositETHToAave(ethAmount);

                    expect(
                        aaveWrappedTokenGatewayMockContract.depositETH
                    ).to.have.been.calledOnce;
                });
            });

            it("updates ETH and WETH token balances", async () => {
                const userETHBalanceBefore = await deFiExchangeContract.getUserETHBalance();
                const userWETHBalanceBefore = await deFiExchangeContract.getUserWETHBalance();

                expect(userETHBalanceBefore).to.eq(ethAmount);
                expect(userWETHBalanceBefore).to.eq(0);

                await deFiExchangeContract.depositETHToAave(ethAmount);
                const userETHBalanceAfter = await deFiExchangeContract.getUserETHBalance();
                const userWETHBalanceAfter = await deFiExchangeContract.getUserWETHBalance();

                expect(userETHBalanceAfter).to.eq(0);
                expect(userWETHBalanceAfter).to.eq(ethAmount);
            });

            it("updates user deposited ETH balance", async () => {
                const userDepositedETHBefore = await deFiExchangeContract.getUserTotalDepositedETHtoAave();

                expect(userDepositedETHBefore).to.equal(0);

                await deFiExchangeContract.depositETHToAave(ethAmount);
                const userDepositedETHAfter = await deFiExchangeContract.getUserTotalDepositedETHtoAave();

                expect(userDepositedETHAfter).to.equal(ethAmount);
            });

            it("emits ETHDepositedToAave", async () => {
                expect(
                    await deFiExchangeContract.depositETHToAave(ethAmount)
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

        describe("borrowDAIFromAave", async () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
                await deFiExchangeContract.depositETH({ value: ethAmount });
            });

            context("with sufficient deposited ETH as collateral", async () => {
                const expectedDAIAmount = ethers.utils.parseUnits("80", 18);

                beforeEach(async () => {
                    await deFiExchangeContract.depositETHToAave(ethAmount);
                });

                it("updates user DAI balance", async () => {
                    const daiBalanceBefore = await deFiExchangeContract.getUserDAIBalance();

                    expect(daiBalanceBefore).to.equal(0);

                    await deFiExchangeContract.borrowDAIFromAave();
                    const daiBalance = await deFiExchangeContract.getUserDAIBalance();

                    expect(daiBalance).to.equal(expectedDAIAmount);
                });

                it("calls getAssetPrice function on Aave Price Oracle contract", async () => {
                    await deFiExchangeContract.borrowDAIFromAave();

                    expect(
                        aaveOracleContract.getAssetPrice
                    ).to.have.been.calledWith(DAITokenMockContract.address);
                });

                it("calls borrow function on Aave Pool contract", async () => {
                    await deFiExchangeContract.borrowDAIFromAave();

                    expect(
                        aavePoolMockContract.borrow
                    ).to.have.been.calledWith(DAITokenMockContract.address, expectedDAIAmount, 2, 0, deFiExchangeContract.address);
                });

                it("emits BorrowedDAIFromAave", async () => {
                    expect(
                        await deFiExchangeContract.borrowDAIFromAave()
                    ).to.emit("BorrowedDAIFromAave");
                });
            });

            context("without sufficient deposited ETH as collateral", async () => {
                it("reverts transaction", async () => {
                    await expect(
                        deFiExchangeContract.borrowDAIFromAave()
                    ).to.be.revertedWith("DeFiExchange__InsufficientDepositedToAaveETHBalance");
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
                    const userDAIBalanceBefore = await deFiExchangeContract.getUserDAIBalance();
                    const userUSDTBalanceBefore = await deFiExchangeContract.getUserUSDTBalance();

                    expect(userDAIBalanceBefore).to.eq(swapAmount);
                    expect(userUSDTBalanceBefore).to.eq(0);

                    await deFiExchangeContract.performTokensSwap(
                        DAITokenMockContract.address,
                        USDTTokenMockContract.address,
                        swapAmount
                    );

                    const userDAIBalanceAfter = await deFiExchangeContract.getUserDAIBalance();
                    const userUSDTBalanceAfter = await deFiExchangeContract.getUserUSDTBalance();

                    expect(userDAIBalanceAfter).to.eq(0);
                    expect(userUSDTBalanceAfter).to.eq(swapAmount);
                });

                it("emits UniswapTokensSwapPerformed", async () => {
                    expect(
                        await deFiExchangeContract.performTokensSwap(
                            DAITokenMockContract.address,
                            USDTTokenMockContract.address,
                            swapAmount
                        )
                    ).to.emit("UniswapTokensSwapPerformed");
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
                    const stakingAmountAfter = await deFiExchangeContract.getUserEthStaked();

                    expect(stakingAmountAfter).to.eq(amount);
                });

                it("mints governance tokens", async () => {
                    await deFiExchangeContract.stakeETHForGovernance({ value: amount });
                    const stakingAmountAfter = await deFiExchangeContract.getUserEthStaked();
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
                    const stakingAmountAfter = await deFiExchangeContract.getUserETHBalance();

                    expect(stakingAmountAfter).to.eq(0);
                });

                it("burns governance tokens", async () => {
                    const stakingAmountBefore = await deFiExchangeContract.getUserEthStaked();
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

            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            it("updates user's ETH balance", async () => {
                await deFiExchangeContract.depositETH({ value: amount });
                const totalBalance = await deFiExchangeContract.getUserETHBalance();
                
                expect(totalBalance).to.eq(amount);
            });

            it("emits event TokenDeposited", async () => {
                expect(
                    await deFiExchangeContract.depositETH({ value: amount })
                ).to.emit("TokenDeposited");
            });
        });

        describe("depositDAI", () => {
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's DAI balance", async () => {
                    await deFiExchangeContract.depositDAI(amount);
                    
                    expect(
                        DAITokenMockContract.allowance
                    ).to.have.been.calledWith(user.address, deFiExchangeContract.address);
                    expect(
                        DAITokenMockContract.transferFrom
                    ).to.have.been.calledWith(user.address, deFiExchangeContract.address, amount);
                    
                    const totalBalance = await deFiExchangeContract.getUserDAIBalance();

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
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when depositer has sufficient balance", () => {
                const amount = ethers.utils.parseUnits("100", 18);

                it("updates user's USDT balance", async () => {
                    await deFiExchangeContract.depositUSDT(amount);

                    expect(
                        USDTTokenMockContract.allowance
                    ).to.have.been.calledWith(user.address, deFiExchangeContract.address);
                    expect(
                        USDTTokenMockContract.transferFrom
                    ).to.have.been.calledWith(user.address, deFiExchangeContract.address, amount);

                    const totalBalance = await deFiExchangeContract.getUserUSDTBalance();

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
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseEther("100");
                const feeAmount = ethers.utils.parseEther("1");

                beforeEach(async () => {
                    await deFiExchangeContract.depositETH({ value: amount });
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.getUserETHBalance();
                    const userBalanceBefore = await user.getBalance();
                    const txResponse = await deFiExchangeContract.withdrawETH();
                    const transactionReceipt = await txResponse.wait(1);
                    const { gasUsed, effectiveGasPrice } = transactionReceipt;
                    const gasCost = gasUsed.mul(effectiveGasPrice);
                    const userBalanceAfter = await user.getBalance();

                    expect(
                        userBalanceAfter.add(gasCost).add(feeAmount).toString()
                    ).to.eq(userAmountBefore.add(userBalanceBefore).toString());
                });

                it("withdraws fee", async () => {
                    const feeAmountBefore = await deFiExchangeContract.getTotalETHFees();

                    expect(feeAmountBefore).to.eq(0);

                    await deFiExchangeContract.withdrawETH();
                    const feeAmountAfter = await deFiExchangeContract.getTotalETHFees();

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
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseUnits("100", 18);
                const feeAmount = ethers.utils.parseUnits("1", 18);
                const withdrawAmount = ethers.utils.parseUnits("99", 18);

                beforeEach(async () => {
                    await deFiExchangeContract.depositDAI(amount);
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.getUserDAIBalance();

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawDAI();

                    expect(
                        DAITokenMockContract.transfer
                    ).to.have.been.calledWith(user.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.getUserDAIBalance();

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
            beforeEach(async () => {
                deFiExchangeContract = deFiExchangeContract.connect(user);
            });

            context("when amount greater then 0", () => {
                const amount = ethers.utils.parseUnits("100", 18);
                const feeAmount = ethers.utils.parseUnits("1", 18);
                const withdrawAmount = ethers.utils.parseUnits("99", 18);

                beforeEach(async () => {
                    await deFiExchangeContract.depositUSDT(amount);
                });

                it("withdraws amount", async () => {
                    const userAmountBefore = await deFiExchangeContract.getUserUSDTBalance();

                    expect(userAmountBefore).to.eq(amount);

                    await deFiExchangeContract.withdrawUSDT();

                    expect(
                        USDTTokenMockContract.transfer
                    ).to.have.been.calledWith(user.address, withdrawAmount);

                    const userAmountAfter = await deFiExchangeContract.getUserUSDTBalance();

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
