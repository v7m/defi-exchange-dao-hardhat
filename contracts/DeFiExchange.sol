// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
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

contract DeFiExchange is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using TransferHelper for address;

    // Constants
    uint8 public constant AAVE_LTV = 80; // The maximum Loan To Value (LTV) ratio for the deposited asset/ETH = 0.8
    uint8 public constant AAVE_REFERAL_CODE = 0; // referralCode 0 is like none
    uint8 public constant AAVE_VARIABLE_RATE = 2; // 1 is stable rate, 2 is variable rate

    // Immutable State Variables
    uint24 public s_uniswapPoolFee;
    uint8 public s_stakingToGovernancePercentage;
    address public s_aavePoolAddress;

    // External Contract References
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

    // Regular State Variables
    uint256 public s_daiEthPrice;
    uint8 public s_withdrawFeePercentage;

    struct ContractAddresses {
        address DAITokenAddress;
        address USDTTokenAddress;
        address WETHTokenAddress;
        address liquidityPoolNFTAddress;
        address governanceTokenAddress;
        address aaveWrappedTokenGatewayAddress;
        address aavePoolAddressesProviderAddress;
        address aaveOracleAddress;
        address uniswapSwapRouterAddress;
    }

    struct FeesAmounts {
        uint256 ethFees;
        mapping(address => uint256) tokensFees;
    }

    struct LiquidityProvidedAmounts {
        uint256 ethAmount;
        mapping(address => uint256) tokensAmounts;
    }

    struct UserBalances {
        uint256 ethBalance;
        uint256 ethStaked;
        uint256 ethDepositedToAave;
        mapping(address => uint256) tokensBalances;
        mapping(uint256 => mapping(address => uint256)) nftTokensLiquidityProvided;
        mapping(uint256 => uint256) nftEthLiquidityProvided;
    }

    // State Variables for Structs
    FeesAmounts private s_feesAmounts;
    LiquidityProvidedAmounts private s_liquidityProvidedAmounts;
    mapping(address => UserBalances) private s_userBalances;

    event ETHDeposited(address indexed sender, uint256 amount);
    event ETHWithdrawn(address indexed sender, uint256 amount);
    event TokenDeposited(address indexed token, address indexed sender, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed sender, uint256 amount);
    event WithdrawFeePercentageChanged(uint8 newWithdrawFeePercentage);
    event StakedETHForGovernance(address indexed sender, uint256 stakingAmount, uint256 governanceAmount);
    event WithdrawStakedETHForGovernance(address indexed sender, uint256 stakingAmount, uint256 governanceAmount);
    event UniswapTokensSwapPerformed(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event ETHDepositedToAave(address indexed sender, uint256 amount);
    event BorrowedDAIFromAave(address indexed sender, uint256 priceDAI, uint256 amount);
    event LiquidityProvided(address indexed sender, uint256 NFTTokenId, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
    event LiquidityRedeemed(address indexed sender, uint256 NFTTokenId, uint256 ethAmount, uint256 usdtAmount, uint256 daiAmount);
    event ETHLiquidityRedeemd(address indexed sender, uint256 ethAmount);

    function initialize(
        ContractAddresses memory addresses,
        uint24 uniswapPoolFee,
        uint8 withdrawFeePercentage,
        uint8 stakingToGovernancePercentage,
        address initialOwner
    ) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();

        s_DAIToken = IERC20(addresses.DAITokenAddress);
        s_USDTToken = IERC20(addresses.USDTTokenAddress);
        s_WETHToken = IWETH(addresses.WETHTokenAddress);
        s_liquidityPoolNFT = LiquidityPoolNFT(addresses.liquidityPoolNFTAddress);
        s_governanceToken = GovernanceToken(addresses.governanceTokenAddress);
        s_aaveWrappedTokenGateway = IWrappedTokenGatewayV3(addresses.aaveWrappedTokenGatewayAddress);
        s_aavePoolAddressesProvider = IPoolAddressesProvider(addresses.aavePoolAddressesProviderAddress);
        s_aavePoolAddress = s_aavePoolAddressesProvider.getPool();
        s_aavePool = IPool(s_aavePoolAddress);
        s_aaveOracle = IAaveOracle(addresses.aaveOracleAddress);
        s_uniswapSwapRouter = ISwapRouter(addresses.uniswapSwapRouterAddress);
        s_uniswapPoolFee = uniswapPoolFee;
        s_withdrawFeePercentage = withdrawFeePercentage;
        s_stakingToGovernancePercentage = stakingToGovernancePercentage;
    }

    fallback() external payable {
        this.depositETH{value: msg.value}();
    }

    receive() external payable {
        this.depositETH{value: msg.value}();
    }

    // EXTERNAL FUNCTIONS

    function changeWithdrawFeePercentage(uint8 _withdrawFeePercentage) external onlyOwner {
        if (_withdrawFeePercentage > 100) {
            revert DeFiExchange__InvalidNewWithdrawFeePercentage(s_withdrawFeePercentage, _withdrawFeePercentage);
        }
        s_withdrawFeePercentage = _withdrawFeePercentage;
        emit WithdrawFeePercentageChanged(s_withdrawFeePercentage);
    }

    function provideLiquidity(
        uint256 usdtAmount,
        uint256 daiAmount
    ) external payable nonReentrant returns (uint256) {
        uint256 ethAmount = msg.value;
        if (ethAmount == 0 && usdtAmount == 0 && daiAmount == 0) {
            revert DeFiExchange__InvalidAmountForLiquidityProviding(msg.sender, ethAmount, usdtAmount, daiAmount);
        }
        _processTokenLiquidityProviding(s_DAIToken, daiAmount, address(s_DAIToken));
        _processTokenLiquidityProviding(s_USDTToken, usdtAmount, address(s_USDTToken));
        if (ethAmount > 0) {
            s_liquidityProvidedAmounts.ethAmount += ethAmount;
        }
        uint256 liquidityPoolNFTTokenId = s_liquidityPoolNFT.mintNFT(msg.sender, ethAmount, daiAmount, usdtAmount);
        _saveNFTLiquidity(msg.sender, liquidityPoolNFTTokenId, ethAmount, daiAmount, usdtAmount);
        emit LiquidityProvided(msg.sender, liquidityPoolNFTTokenId, ethAmount, usdtAmount, daiAmount);
        return liquidityPoolNFTTokenId;
    }

    function redeemLiquidity(uint256 tokenId) external nonReentrant {
        if (!_isNFTOwner(msg.sender, tokenId)) {
            revert DeFiExchange__SenderIsNotOwnerOfNFT(msg.sender, tokenId);
        }
        UserBalances storage userBalances = s_userBalances[msg.sender];
        uint256 ethAmount = userBalances.nftEthLiquidityProvided[tokenId];
        uint256 daiAmount = userBalances.nftTokensLiquidityProvided[tokenId][address(s_DAIToken)];
        uint256 usdtAmount = userBalances.nftTokensLiquidityProvided[tokenId][address(s_USDTToken)];
        _processTokenLiquidityRedeeming(s_DAIToken, msg.sender, daiAmount, address(s_DAIToken), tokenId);
        _processTokenLiquidityRedeeming(s_USDTToken, msg.sender, usdtAmount, address(s_USDTToken), tokenId);
        if (ethAmount > 0) {
            s_liquidityProvidedAmounts.ethAmount -= ethAmount;
            userBalances.nftEthLiquidityProvided[tokenId] = 0;
            (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
            if (!success) {
                revert DeFiExchange__RedeemLiquidityETHFail(msg.sender, ethAmount);
            }
            emit ETHLiquidityRedeemd(msg.sender, ethAmount);
        }
        s_liquidityPoolNFT.burnNFT(msg.sender, tokenId);
        emit LiquidityRedeemed(msg.sender, tokenId, ethAmount, daiAmount, usdtAmount);
    }

    function depositETHToAave(uint256 amount) external nonReentrant {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        if (userBalances.ethBalance < amount) {
            revert DeFiExchange__NotEnoughETHForDepositingToAave(msg.sender, amount);
        }
        address onBehalfOf = address(this);
        userBalances.ethBalance -= amount;
        userBalances.tokensBalances[address(s_WETHToken)] += amount;
        userBalances.ethDepositedToAave += amount;
        s_aaveWrappedTokenGateway.depositETH{ value: amount }(s_aavePoolAddress, onBehalfOf, 0);
        emit ETHDepositedToAave(msg.sender, amount);
    }

    function borrowDAIFromAave() external nonReentrant {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        if (userBalances.ethDepositedToAave == 0) {
            revert DeFiExchange__InsufficientDepositedToAaveETHBalance(msg.sender);
        }
        uint priceDAI = s_aaveOracle.getAssetPrice(address(s_DAIToken));
        s_daiEthPrice = priceDAI;
        assert(priceDAI != 0);
        uint safeMaxDAIBorrow = AAVE_LTV * userBalances.ethDepositedToAave / (priceDAI * 100);
        userBalances.tokensBalances[address(s_DAIToken)] += safeMaxDAIBorrow;
        s_aavePool.borrow(address(s_DAIToken), safeMaxDAIBorrow, AAVE_VARIABLE_RATE, AAVE_REFERAL_CODE, address(this));
        emit BorrowedDAIFromAave(msg.sender, priceDAI, safeMaxDAIBorrow);
    }

    function swapDaiToUsdt(uint256 amount) external {
        performTokensSwap(address(s_DAIToken), address(s_USDTToken), amount);
    }

    function swapUsdtToDai(uint256 amount) external {
        performTokensSwap(address(s_USDTToken), address(s_DAIToken), amount);
    }

    function stakeETHForGovernance() external payable nonReentrant {
        uint256 stakingAmount = msg.value;
        if (stakingAmount == 0) {
            revert DeFiExchange__NotEnoughETHForStaking(msg.sender);
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakingAmount);
        UserBalances storage userBalances = s_userBalances[msg.sender];
        userBalances.ethStaked += stakingAmount;
        s_governanceToken.mint(msg.sender, governanceAmount);

        emit StakedETHForGovernance(msg.sender, stakingAmount, governanceAmount);
    }

    function withdrawStakedETHForGovernance() external nonReentrant {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        uint256 stakedAmount = userBalances.ethStaked;
        if (stakedAmount == 0) {
            revert DeFiExchange__ETHIsNotStaked(msg.sender);
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakedAmount);
        s_governanceToken.burn(msg.sender, governanceAmount);
        userBalances.ethStaked = 0;
        (bool success, ) = payable(msg.sender).call{value: stakedAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawStakedETHFail(msg.sender);
        }
        emit WithdrawStakedETHForGovernance(msg.sender, stakedAmount, governanceAmount);
    }

    function withdrawETH() external nonReentrant() {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        uint256 totalAmount = userBalances.ethBalance;
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawETHBalance(msg.sender);
        }
        uint256 fee = _calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_feesAmounts.ethFees += fee;
        userBalances.ethBalance = 0;
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawETHFail(msg.sender);
        }
        emit ETHWithdrawn(msg.sender, withdrawAmount);
    }

    function withdrawDAI() external nonReentrant() {
        _withdrawToken(s_DAIToken);
    }

    function withdrawUSDT() external nonReentrant() {
        _withdrawToken(s_USDTToken);
    }

    function depositETH() external payable {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        userBalances.ethBalance += msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }

    function depositDAI(uint256 _amount) external nonReentrant {
        _depositToken(s_DAIToken, _amount);
    }

    function depositUSDT(uint256 _amount) external nonReentrant {
        _depositToken(s_USDTToken, _amount);
    }

    // GETTER FUNCTIONS

    function getWithdrawFeePercentage() external view returns (uint8) {
        return s_withdrawFeePercentage;
    }

    function getUserETHBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].ethBalance;
    }

    function getUserDAIBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_DAIToken)];
    }

    function getUserUSDTBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_USDTToken)];
    }
    function getUserWETHBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_WETHToken)];
    }

    function getTotalETHFees() external view returns (uint256) {
        return s_feesAmounts.ethFees;
    }

    function getTotalDAIFees() external view returns (uint256) {
        return s_feesAmounts.tokensFees[address(s_DAIToken)];
    }

    function getTotalUSDTFees() external view returns (uint256) {
        return s_feesAmounts.tokensFees[address(s_USDTToken)];
    }

    function getLiquidityPoolETHAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.ethAmount;
    }

    function getLiquidityPoolDAIAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.tokensAmounts[address(s_DAIToken)];
    }

    function getLiquidityPoolUSDTAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.tokensAmounts[address(s_USDTToken)];
    }

    function getNFTUserETHLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftEthLiquidityProvided[nftTokenId];
    }

    function getNFTUserUSDTLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftTokensLiquidityProvided[nftTokenId][address(s_USDTToken)];
    }

    function getNFTUserDAILiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftTokensLiquidityProvided[nftTokenId][address(s_DAIToken)];
    }

    function getUserTotalDepositedETHtoAave() external view returns (uint256) {
        return s_userBalances[msg.sender].ethDepositedToAave;
    }

    function getUserEthStaked() external view returns (uint256) {
        return s_userBalances[msg.sender].ethStaked;
    }

    // PUBLIC FUNCTIONS

    function performTokensSwap(
        address tokenInAddress,
        address tokenOutAddress,
        uint256 amountIn
    ) public nonReentrant {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        if (userBalances.tokensBalances[tokenInAddress] < amountIn) {
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

        userBalances.tokensBalances[tokenInAddress] -= amountIn;
        userBalances.tokensBalances[tokenOutAddress] += amountOut;
        emit UniswapTokensSwapPerformed(tokenInAddress, tokenOutAddress, amountIn, amountOut);
    }

    function calculateGovernanceTokensAmount(uint256 ethAmount) public view returns (uint256) {
        uint256 governanceAmount = (ethAmount * s_stakingToGovernancePercentage) / 100;

        return governanceAmount;
    }

    // PRIVATE FUNCTIONS

    function _processTokenLiquidityProviding(IERC20 token, uint256 amount, address tokenAddress) private {
        if (amount > 0) {
            if (token.allowance(msg.sender, address(this)) < amount) {
                revert DeFiExchange__InsufficientLiquidityProvidingTokenBalance(address(token), msg.sender, amount);
            }
            token.safeTransferFrom(msg.sender, address(this), amount);
            s_liquidityProvidedAmounts.tokensAmounts[tokenAddress] += amount;
        }
    }

    function _saveNFTLiquidity(
        address user,
        uint256 tokenId,
        uint256 ethAmount,
        uint256 daiAmount,
        uint256 usdtAmount
    ) private {
        UserBalances storage userBalances = s_userBalances[user];
        userBalances.nftEthLiquidityProvided[tokenId] = ethAmount;
        userBalances.nftTokensLiquidityProvided[tokenId][address(s_DAIToken)] = daiAmount;
        userBalances.nftTokensLiquidityProvided[tokenId][address(s_USDTToken)] = usdtAmount;
    }

    function _processTokenLiquidityRedeeming(
        IERC20 token,
        address user,
        uint256 amount,
        address tokenAddress,
        uint256 tokenId
    ) private {
        if (amount > 0) {
            token.safeTransfer(user, amount);
            s_liquidityProvidedAmounts.tokensAmounts[tokenAddress] -= amount;
            s_userBalances[user].nftTokensLiquidityProvided[tokenId][tokenAddress] = 0;
        }
    }

    function _withdrawToken(IERC20 token) private {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        address tokenAddress = address(token);
        uint256 totalAmount = userBalances.tokensBalances[tokenAddress];

        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawTokenBalance(tokenAddress, msg.sender);
        }

        uint256 fee = _calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_feesAmounts.tokensFees[tokenAddress] += fee;
        userBalances.tokensBalances[tokenAddress] = 0;

        token.safeTransfer(msg.sender, withdrawAmount);
        emit TokenWithdrawn(tokenAddress, msg.sender, withdrawAmount);
    }

    function _depositToken(IERC20 token, uint256 amount) private {
        address tokenAddress = address(token);
        if (token.allowance(msg.sender, address(this)) < amount) {
            revert DeFiExchange__InsufficientDepositTokenBalance(tokenAddress, msg.sender);
        }
        token.safeTransferFrom(msg.sender, address(this), amount);
        s_userBalances[msg.sender].tokensBalances[tokenAddress] += amount;
        emit TokenDeposited(tokenAddress, msg.sender, amount);
    }

    function _isNFTOwner(address user, uint256 tokenId) private view returns (bool) {
        address owner = s_liquidityPoolNFT.ownerOf(tokenId);
        return owner == user;
    }

    function _calculateWithdrawalFee(uint256 amount) private view returns (uint256) {
        uint256 fee = (amount * s_withdrawFeePercentage) / 100;

        return fee;
    }
}
