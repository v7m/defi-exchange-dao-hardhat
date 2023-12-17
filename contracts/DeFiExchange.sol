// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import "@aave/periphery-v3/contracts/misc/interfaces/IWrappedTokenGatewayV3.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IAaveOracle.sol";
import "@aave/core-v3/contracts/misc/interfaces/IWETH.sol";
import "./GovernanceToken.sol";
import "./LiquidityPoolNFT.sol";

error DeFiExchange__InsufficientDepositTokenBalance(address token, address sender);
error DeFiExchange__InsufficientWithdrawTokenBalance(address token, address sender);
error DeFiExchange__InsufficientWithdrawETHBalance(address sender);
error DeFiExchange__WithdrawETHFail(address sender);
error DeFiExchange__InvalidNewWithdrawFeePercentage(uint8 oldWithdrawFeePercentage, uint8 newWithdrawFeePercentage);
error DeFiExchange__ETHIsNotStaked(address sender);
error DeFiExchange__NotEnoughETHForStaking(address sender);
error DeFiExchange__WithdrawStakedETHFail(address sender);
error DeFiExchange__InsufficientSwapTokensBalance(address token, address sender, uint256 amount);
error DeFiExchange__NotEnoughETHForDepositingToAave(address sender, uint256 amount);
error DeFiExchange__InsufficientDepositedToAaveETHBalance(address sender);
error DeFiExchange__InvalidAmountForLiquidityProviding(address sender, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
error DeFiExchange__InsufficientLiquidityProvidingTokenBalance(address token, address sender, uint256 amount);
error DeFiExchange__InsufficientLiquidityProvidingETHBalance(address sender, uint256 amount);
error DeFiExchange__SenderIsNotOwnerOfNFT(address sender, uint256 tokenId);
error DeFiExchange__RedeemLiquidityETHFail(address sender, uint256 amount);


contract DeFiExchange is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using TransferHelper for address;

    uint8 AAVE_LTV = 80; // The maximum Loan To Value (LTV) ratio for the deposited asset/ETH = 0.8
    uint8 AAVE_REFERAL_CODE = 0; // referralCode 0 is like none
    uint8 AAVE_VARIABLE_RATE = 2; // 1 is stable rate, 2 is variable rate

    uint24 public s_uniswapPoolFee;
    uint8 public s_withdrawFeePercentage;
    uint8 public s_stakingToGovernancePercentage;
    address public s_aavePoolAddress;
    uint256 public s_totalEthFees;
    uint256 public s_liquidityPoolETHAmounts;
    uint256 public s_daiEthPrice;

    IERC20 public s_DAIToken;
    IERC20 public s_USDTToken;
    IWETH public s_WETHToken;
    ISwapRouter public s_uniswapSwapRouter;
    IWrappedTokenGatewayV3 public s_aaveWrappedTokenGateway;
    IPoolAddressesProvider public s_aavePoolAddressesProvider;
    IPool public s_aavePool;
    IAaveOracle public s_aaveOracle;
    GovernanceToken public s_governanceToken;
    LiquidityPoolNFT public s_liquidityPoolNFT;

    mapping(address => uint256) public s_totalTokensFees;
    mapping(address => uint256) public s_totalEthStaking;
    mapping(address => uint256) public s_totalEthBalance;
    mapping(address => mapping(address => uint256)) public s_totalTokensBalance;
    mapping(address => uint256) public s_totalEthDepositedToAave;
    mapping(address => uint256) public s_liquidityPoolTokenAmounts;
    // user address => NFT tokenId => token address => amount
    mapping(address => mapping(uint256 => mapping(address => uint256))) public s_NFTUserTokenLiquidityPoolAmounts;
    // user address => NFT tokenId => amount
    mapping(address => mapping(uint256 => uint256)) public s_NFTUserETHLiquidityPoolAmounts;

    event ETHDeposited(address sender, uint256 amount);
    event ETHWithdrawn(address sender, uint256 amount);
    event TokenDeposited(address token, address sender, uint256 amount);
    event TokenWithdrawn(address token, address sender, uint256 amount);
    event WithdrawFeePercentageChanged(uint8 newWithdrawFeePercentage);
    event StakedETHForGovernance(address sender, uint256 stakingAmount, uint256 governanceAmount);
    event WithdrawStakedETHForGovernance(address sender, uint256 stakingAmount, uint256 governanceAmount);
    event UniswapTokensSwapPerformed(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event ETHDepositedToAave(address sender, uint256 amount);
    event BorrowedDAIFromAave(address sender, uint256 priceDAI, uint256 amount);
    event LiquidityProvided(address sender, uint256 NFTTokenId, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
    event LiquidityRedeemed(address sender, uint256 NFTTokenId, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
    event ETHLiquidityRedeemd(address sender, uint256 ethAmount);

    constructor(
        address DAITokenAddress,
        address USDTTokenAddress,
        address WETHTokenAddress,
        address liquidityPoolNFTAddress,
        address governanceTokenAddress,
        address aaveWrappedTokenGatewayAddress,
        address aavePoolAddressesProviderAddress,
        address aaveOracleAddress,
        address uniswapSwapRouterAddress,
        uint24 uniswapPoolFee,
        uint8 withdrawFeePercentage,
        uint8 stakingToGovernancePercentage
    ) {
        s_DAIToken = IERC20(DAITokenAddress);
        s_USDTToken = IERC20(USDTTokenAddress);
        s_WETHToken = IWETH(WETHTokenAddress);
        s_liquidityPoolNFT = LiquidityPoolNFT(liquidityPoolNFTAddress);
        s_governanceToken = GovernanceToken(governanceTokenAddress);
        s_aaveWrappedTokenGateway = IWrappedTokenGatewayV3(aaveWrappedTokenGatewayAddress);
        s_aavePoolAddressesProvider = IPoolAddressesProvider(aavePoolAddressesProviderAddress);
        s_aavePoolAddress = s_aavePoolAddressesProvider.getPool();
        s_aavePool = IPool(s_aavePoolAddress);
        s_aaveOracle = IAaveOracle(aaveOracleAddress);
        s_uniswapSwapRouter = ISwapRouter(uniswapSwapRouterAddress);
        s_uniswapPoolFee = uniswapPoolFee;
        s_withdrawFeePercentage = withdrawFeePercentage;
        s_stakingToGovernancePercentage = stakingToGovernancePercentage;
    }

    function changeWithdrawFeePercentage(uint8 _withdrawFeePercentage) external onlyOwner {
        if (_withdrawFeePercentage > 100) {
            revert DeFiExchange__InvalidNewWithdrawFeePercentage(s_withdrawFeePercentage, _withdrawFeePercentage);
        }
        s_withdrawFeePercentage = _withdrawFeePercentage;
        emit WithdrawFeePercentageChanged(s_withdrawFeePercentage);
    }

    // LIQUIDITY POOL FUNCTIONS

    function provideLiquidity(uint256 usdtAmount, uint256 daiAmount) external payable returns (uint256) {
        uint256 ethAmount = msg.value;
        if (ethAmount == 0 && usdtAmount == 0 && daiAmount == 0) {
            revert DeFiExchange__InvalidAmountForLiquidityProviding(msg.sender, ethAmount, usdtAmount, daiAmount);
        }
        if (daiAmount > 0) {
            if (s_DAIToken.allowance(msg.sender, address(this)) < daiAmount) {
                revert DeFiExchange__InsufficientLiquidityProvidingTokenBalance(address(s_DAIToken), msg.sender, daiAmount);
            }
            s_DAIToken.safeTransferFrom(msg.sender, address(this), daiAmount);
            s_liquidityPoolTokenAmounts[address(s_DAIToken)] += daiAmount;
        }
        if (usdtAmount > 0) {
            if (s_USDTToken.allowance(msg.sender, address(this)) < usdtAmount) {
                revert DeFiExchange__InsufficientLiquidityProvidingTokenBalance(address(s_USDTToken), msg.sender, usdtAmount);
            }
            s_USDTToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
            s_liquidityPoolTokenAmounts[address(s_USDTToken)] += usdtAmount;
        }
        if (ethAmount > 0) {
            s_liquidityPoolETHAmounts += ethAmount;
        }
        uint256 liquidityPoolNFTTokenId = s_liquidityPoolNFT.mintNFT(msg.sender, ethAmount, daiAmount, usdtAmount);
        s_NFTUserETHLiquidityPoolAmounts[msg.sender][liquidityPoolNFTTokenId] = ethAmount;
        s_NFTUserTokenLiquidityPoolAmounts[msg.sender][liquidityPoolNFTTokenId][address(s_DAIToken)] = daiAmount;
        s_NFTUserTokenLiquidityPoolAmounts[msg.sender][liquidityPoolNFTTokenId][address(s_USDTToken)] = usdtAmount;
        emit LiquidityProvided(msg.sender, liquidityPoolNFTTokenId, ethAmount, usdtAmount, daiAmount);
        return liquidityPoolNFTTokenId;
    }

    function redeemLiquidity(uint256 tokenId) external {
        if (!isOwnerOfNFT(msg.sender, tokenId)) {
            revert DeFiExchange__SenderIsNotOwnerOfNFT(msg.sender, tokenId);
        }
        uint256 ethAmount = s_NFTUserETHLiquidityPoolAmounts[msg.sender][tokenId];
        uint256 daiAmount = s_NFTUserTokenLiquidityPoolAmounts[msg.sender][tokenId][address(s_DAIToken)];
        uint256 usdtAmount = s_NFTUserTokenLiquidityPoolAmounts[msg.sender][tokenId][address(s_USDTToken)];
        if (daiAmount > 0) {
            s_DAIToken.safeTransfer(msg.sender, daiAmount);
            s_liquidityPoolTokenAmounts[address(s_DAIToken)] -= daiAmount;
            s_NFTUserTokenLiquidityPoolAmounts[msg.sender][tokenId][address(s_DAIToken)] = 0;
        }
        if (usdtAmount > 0) {
            s_USDTToken.safeTransfer(msg.sender, usdtAmount);
            s_liquidityPoolTokenAmounts[address(s_USDTToken)] -= usdtAmount;
            s_NFTUserTokenLiquidityPoolAmounts[msg.sender][tokenId][address(s_USDTToken)] = 0;
        }
        if (ethAmount > 0) {
            s_liquidityPoolETHAmounts -= ethAmount;
            s_NFTUserETHLiquidityPoolAmounts[msg.sender][tokenId] = 0;
            (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
            if (!success) {
                revert DeFiExchange__RedeemLiquidityETHFail(msg.sender, ethAmount);
            }
            emit ETHLiquidityRedeemd(msg.sender, ethAmount);
        }
        s_liquidityPoolNFT.burnNFT(msg.sender, tokenId);
        emit LiquidityRedeemed(msg.sender, tokenId, ethAmount, daiAmount, usdtAmount);
    }


    function isOwnerOfNFT(address user, uint256 tokenId) public view returns (bool) {
        address owner = s_liquidityPoolNFT.ownerOf(tokenId);
        return owner == user;
    }

    // AAVE FUNCTIONS

    function depositETHToAave(uint256 amount) external nonReentrant {
        if (s_totalEthBalance[msg.sender] < amount) {
            revert DeFiExchange__NotEnoughETHForDepositingToAave(msg.sender, amount);
        }
        address onBehalfOf = address(this);
        s_totalEthBalance[msg.sender] -= amount;
        s_totalTokensBalance[msg.sender][address(s_WETHToken)] += amount;
        s_totalEthDepositedToAave[msg.sender] += amount;
        s_aaveWrappedTokenGateway.depositETH{ value: amount }(s_aavePoolAddress, onBehalfOf, 0);
        emit ETHDepositedToAave(msg.sender, amount);
    }

    function borrowDAIFromAave() external nonReentrant {
        if (s_totalEthDepositedToAave[msg.sender] == 0) {
            revert DeFiExchange__InsufficientDepositedToAaveETHBalance(msg.sender);
        }
        uint priceDAI = s_aaveOracle.getAssetPrice(address(s_DAIToken));
        s_daiEthPrice = priceDAI;
        assert(priceDAI != 0);
        uint safeMaxDAIBorrow = AAVE_LTV * s_totalEthDepositedToAave[msg.sender] / (priceDAI * 100);
        s_totalTokensBalance[msg.sender][address(s_DAIToken)] += safeMaxDAIBorrow;
        s_aavePool.borrow(address(s_DAIToken), safeMaxDAIBorrow, AAVE_VARIABLE_RATE, AAVE_REFERAL_CODE, address(this));
        emit BorrowedDAIFromAave(msg.sender, priceDAI, safeMaxDAIBorrow);
    }

    // UNISWAP SWAP TOKENS FUNCTIONS

    function swapDaiToUsdt(uint256 amount) external {
        performTokensSwap(address(s_DAIToken), address(s_USDTToken), amount);
    }

    function swapUsdtToDai(uint256 amount) external {
        performTokensSwap(address(s_USDTToken), address(s_DAIToken), amount);
    }

    function performTokensSwap(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn
    ) public nonReentrant {
        if (s_totalTokensBalance[msg.sender][tokenInAddress] < amountIn) {
            revert DeFiExchange__InsufficientSwapTokensBalance(tokenInAddress, msg.sender, amountIn);
        }

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                fee: s_uniswapPoolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint amountOut = s_uniswapSwapRouter.exactInputSingle(params);

        s_totalTokensBalance[msg.sender][tokenInAddress] -= amountIn;
        s_totalTokensBalance[msg.sender][tokenOutAddress] += amountOut;
        emit UniswapTokensSwapPerformed(tokenInAddress, tokenOutAddress, amountIn, amountOut);
    }

    // STAKING FUNCTIONS

    function stakeETHForGovernance() external payable nonReentrant {
        uint256 stakingAmount = msg.value;
        if (stakingAmount == 0) {
            revert DeFiExchange__NotEnoughETHForStaking(msg.sender);
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakingAmount);
        s_totalEthStaking[msg.sender] += stakingAmount;
        s_governanceToken.mint(msg.sender, governanceAmount);

        emit StakedETHForGovernance(msg.sender, stakingAmount, governanceAmount);
    }

    function withdrawStakedETHForGovernance() external nonReentrant {
        uint256 stakedAmount = s_totalEthStaking[msg.sender];
        if (stakedAmount == 0) {
            revert DeFiExchange__ETHIsNotStaked(msg.sender);
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakedAmount);
        s_governanceToken.burn(msg.sender, governanceAmount);
        s_totalEthStaking[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: stakedAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawStakedETHFail(msg.sender);
        }
        emit WithdrawStakedETHForGovernance(msg.sender, stakedAmount, governanceAmount);
    }

    function calculateGovernanceTokensAmount(uint256 ethAmount) public view returns (uint256) {
        uint256 governanceAmount = (ethAmount * s_stakingToGovernancePercentage) / 100;

        return governanceAmount;
    }

    // DEPOSIT FUNCTIONS

    function depositETH() external payable {
        s_totalEthBalance[msg.sender] = s_totalEthBalance[msg.sender] + msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }

    function depositDAI(uint256 _amount) external {
        if (s_DAIToken.allowance(msg.sender, address(this)) < _amount) {
            revert DeFiExchange__InsufficientDepositTokenBalance(address(s_DAIToken), msg.sender);
        }

        s_DAIToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalTokensBalance[msg.sender][address(s_DAIToken)] += _amount;
        emit TokenDeposited(address(s_DAIToken), msg.sender, _amount);
    }

    function depositUSDT(uint256 _amount) external {
        if (s_USDTToken.allowance(msg.sender, address(this)) < _amount) {
            revert DeFiExchange__InsufficientDepositTokenBalance(address(s_USDTToken), msg.sender);
        }

        s_USDTToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalTokensBalance[msg.sender][address(s_USDTToken)] += _amount;
        emit TokenDeposited(address(s_DAIToken), msg.sender, _amount);
    }

    // WITHDRAW FUNCTIONS

    function withdrawETH() external nonReentrant() {
        uint256 totalAmount = s_totalEthBalance[msg.sender];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawETHBalance(msg.sender);
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalEthFees += fee;
        s_totalEthBalance[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawETHFail(msg.sender);
        }
        emit ETHWithdrawn(msg.sender, withdrawAmount);
    }

    function withdrawDAI() external nonReentrant() {
        uint256 totalAmount = s_totalTokensBalance[msg.sender][address(s_DAIToken)];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawTokenBalance(address(s_DAIToken), msg.sender);
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalTokensFees[address(s_DAIToken)] += fee;
        s_totalTokensBalance[msg.sender][address(s_DAIToken)] = 0;
        s_DAIToken.safeTransfer(msg.sender, withdrawAmount);
        emit TokenWithdrawn(address(s_DAIToken), msg.sender, withdrawAmount);
    }

    function withdrawUSDT() external nonReentrant() {
        uint256 totalAmount = s_totalTokensBalance[msg.sender][address(s_USDTToken)];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawTokenBalance(address(s_USDTToken), msg.sender);
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalTokensFees[address(s_USDTToken)] += fee;
        s_totalTokensBalance[msg.sender][address(s_USDTToken)] = 0;
        s_USDTToken.safeTransfer(msg.sender, withdrawAmount);
        emit TokenWithdrawn(address(s_USDTToken), msg.sender, withdrawAmount);
    }

    function calculateWithdrawalFee(uint256 amount) internal view returns (uint256) {
        uint256 fee = (amount * s_withdrawFeePercentage) / 100;

        return fee;
    }

    // GETTER FUNCTIONS

    function getWithdrawFeePercentage() external view returns (uint8) {
        return s_withdrawFeePercentage;
    }

    function getUserETHBalance() external view returns (uint256) {
        return s_totalEthBalance[msg.sender];
    }

    function getUserDAIBalance() external view returns (uint256) {
        return s_totalTokensBalance[msg.sender][address(s_DAIToken)];
    }

    function getUserUSDTBalance() external view returns (uint256) {
        return s_totalTokensBalance[msg.sender][address(s_USDTToken)];
    }
    function getUserWETHBalance() external view returns (uint256) {
        return s_totalTokensBalance[msg.sender][address(s_WETHToken)];
    }

    function getTotalETHFees() external view returns (uint256) {
        return s_totalEthFees;
    }

    function getTotalDAIFees() external view returns (uint256) {
        return s_totalTokensFees[address(s_DAIToken)];
    }

    function getTotalUSDTFees() external view returns (uint256) {
        return s_totalTokensFees[address(s_USDTToken)];
    }

    function getLiquidityPoolETHAmount() external view returns (uint256) {
        return s_liquidityPoolETHAmounts;
    }

    function getLiquidityPoolDAIAmount() external view returns (uint256) {
        return s_liquidityPoolTokenAmounts[address(s_DAIToken)];
    }

    function getLiquidityPoolUSDTAmount() external view returns (uint256) {
        return s_liquidityPoolTokenAmounts[address(s_USDTToken)];
    }

    function getNFTUserETHLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_NFTUserETHLiquidityPoolAmounts[msg.sender][nftTokenId];
    }

    function getNFTUserUSDTLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_NFTUserTokenLiquidityPoolAmounts[msg.sender][nftTokenId][address(s_USDTToken)];
    }

    function getNFTUserDAILiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_NFTUserTokenLiquidityPoolAmounts[msg.sender][nftTokenId][address(s_DAIToken)];
    }

    function getUserTotalDepositedETHtoAave() external view returns (uint256) {
        return s_totalEthDepositedToAave[msg.sender];
    }
}
