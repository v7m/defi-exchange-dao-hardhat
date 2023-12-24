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

/**
 * @title DeFiExchange
 * @dev This contract represents a decentralized finance exchange.
 * @notice This contract allows users to trade tokens and provides various functionalities for managing the exchange.
 */
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

    /**
     * @dev Initializes the DeFiExchange contract with the provided parameters.
     * @param addresses The contract addresses for various tokens and contracts.
     * @param uniswapPoolFee The fee percentage for Uniswap pool transactions.
     * @param withdrawFeePercentage The fee percentage for withdrawals.
     * @param stakingToGovernancePercentage The percentage of staking rewards allocated to governance.
     * @param initialOwner The initial owner of the contract.
     */
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

    /**
     * @dev Fallback function that allows the contract to receive Ether.
     * It calls the `depositETH` function with the received Ether value.
     */
    fallback() external payable {
        this.depositETH{value: msg.value}();
    }

    /**
     * @dev Receive function that allows the contract to receive Ether.
     * It calls the `depositETH` function with the received Ether value.
     */
    receive() external payable {
        this.depositETH{value: msg.value}();
    }

    // EXTERNAL FUNCTIONS

    /**
     * @dev Changes the withdrawal fee percentage.
     * @dev Only the contract owner can call this function.
     * @param _withdrawFeePercentage The new withdrawal fee percentage.
     */
    function changeWithdrawFeePercentage(uint8 _withdrawFeePercentage) external onlyOwner {
        if (_withdrawFeePercentage > 100) {
            revert DeFiExchange__InvalidNewWithdrawFeePercentage(s_withdrawFeePercentage, _withdrawFeePercentage);
        }
        s_withdrawFeePercentage = _withdrawFeePercentage;
        emit WithdrawFeePercentageChanged(s_withdrawFeePercentage);
    }

    /**
     * @dev Provides liquidity to the DeFi exchange by depositing tokens and/or Ether.
     * @param usdtAmount The amount of USDT tokens to provide as liquidity.
     * @param daiAmount The amount of DAI tokens to provide as liquidity.
     * @return The ID of the liquidity pool NFT token minted for the liquidity provider.
     */
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

    /**
     * @dev Redeems liquidity by burning the liquidity pool NFT token and returning the deposited tokens and Ether 
     * to the liquidity provider.
     * @dev Only the owner of the NFT token can call this function.
     * @param tokenId The ID of the liquidity pool NFT token to redeem.
     */
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

    /**
     * @dev Deposits ETH to Aave protocol.
     * @param amount The amount of ETH to deposit.
     */
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

    /**
     * @dev Allows the user to borrow DAI from Aave.
     */
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

    /**
     * @dev Swaps a specified amount of DAI tokens to USDT tokens.
     * @param amount The amount of DAI tokens to swap.
     */
    function swapDaiToUsdt(uint256 amount) external {
        performTokensSwap(address(s_DAIToken), address(s_USDTToken), amount);
    }

    /**
     * @dev Swaps a specified amount of USDT tokens to DAI tokens.
     * @param amount The amount of USDT tokens to swap.
     */
    function swapUsdtToDai(uint256 amount) external {
        performTokensSwap(address(s_USDTToken), address(s_DAIToken), amount);
    }

    /**
     * @dev Stake ETH for governance.
     * @notice This function allows users to stake ETH in exchange for governance tokens.
     * @dev The amount of ETH staked will be used to calculate the amount of governance tokens to mint.
     */
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

    /**
     * @dev Withdraws the staked ETH for governance tokens.
     * @notice This function allows users to withdraw their staked ETH and receive governance tokens in return.
     * @dev The amount of governance tokens received is calculated based on the staked ETH amount.
     * @dev The staked ETH is burned and the corresponding amount is transferred back to the user.
     */
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

    /**
     * @dev Withdraws ETH from the contract to the caller's address.
     * @notice This function allows the caller to withdraw their ETH balance from the contract.
     * @dev The caller's ETH balance is transferred to their address, after deducting the withdrawal fee.
     * @dev The withdrawal fee is calculated based on the total withdrawal amount.
     */
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

    /**
     * @dev Withdraws DAI tokens from the contract.
     */
    function withdrawDAI() external nonReentrant() {
        _withdrawToken(s_DAIToken);
    }

    /**
     * @dev Withdraws USDT tokens from the contract.
     */
    function withdrawUSDT() external nonReentrant() {
        _withdrawToken(s_USDTToken);
    }

    /**
     * @dev Deposits ETH into the contract.
     * @notice This function allows users to deposit ETH into the contract.
     */
    function depositETH() external payable {
        UserBalances storage userBalances = s_userBalances[msg.sender];
        userBalances.ethBalance += msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Deposits a specified amount of DAI tokens into the contract.
     * @param _amount The amount of DAI tokens to deposit.
     */
    function depositDAI(uint256 _amount) external nonReentrant {
        _depositToken(s_DAIToken, _amount);
    }

    /**
     * @dev Deposits a specified amount of USDT tokens into the contract.
     * @param _amount The amount of USDT tokens to deposit.
     */
    function depositUSDT(uint256 _amount) external nonReentrant {
        _depositToken(s_USDTToken, _amount);
    }

    // GETTER FUNCTIONS

    /**
     * @dev Retrieves the withdrawal fee percentage.
     * @return The withdrawal fee percentage as a uint8 value.
     */
    function getWithdrawFeePercentage() external view returns (uint8) {
        return s_withdrawFeePercentage;
    }

    /**
     * @dev Retrieves the ETH balance of the caller.
     * @return The ETH balance of the caller.
     */
    function getUserETHBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].ethBalance;
    }

    /**
     * @dev Retrieves the DAI token balance of the calling user.
     * @return The DAI token balance of the calling user.
     */
    function getUserDAIBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_DAIToken)];
    }

    /**
     * @dev Retrieves the USDT balance of the caller.
     * @return The USDT balance of the caller.
     */
    function getUserUSDTBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_USDTToken)];
    }

    /**
     * @dev Retrieves the WETH balance of the caller.
     * @return The WETH balance of the caller.
     */
    function getUserWETHBalance() external view returns (uint256) {
        return s_userBalances[msg.sender].tokensBalances[address(s_WETHToken)];
    }

    /**
     * @dev Returns the total amount of ETH fees collected by the contract.
     * @return The total amount of ETH fees collected.
     */
    function getTotalETHFees() external view returns (uint256) {
        return s_feesAmounts.ethFees;
    }

    /**
     * @dev Returns the total fees collected in DAI tokens.
     * @return The total amount of DAI fees collected.
     */
    function getTotalDAIFees() external view returns (uint256) {
        return s_feesAmounts.tokensFees[address(s_DAIToken)];
    }

    /**
     * @dev Returns the total amount of USDT fees collected by the contract.
     * @return The total amount of USDT fees.
     */
    function getTotalUSDTFees() external view returns (uint256) {
        return s_feesAmounts.tokensFees[address(s_USDTToken)];
    }

    /**
     * @dev Retrieves the amount of ETH in the liquidity pool.
     * @return The amount of ETH in the liquidity pool.
     */
    function getLiquidityPoolETHAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.ethAmount;
    }

    /**
     * @dev Retrieves the amount of DAI tokens in the liquidity pool.
     * @return The amount of DAI tokens in the liquidity pool.
     */
    function getLiquidityPoolDAIAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.tokensAmounts[address(s_DAIToken)];
    }

    /**
     * @dev Retrieves the amount of USDT tokens in the liquidity pool.
     * @return The amount of USDT tokens in the liquidity pool.
     */
    function getLiquidityPoolUSDTAmount() external view returns (uint256) {
        return s_liquidityProvidedAmounts.tokensAmounts[address(s_USDTToken)];
    }

    /**
     * @dev Retrieves the amount of ETH liquidity provided by the user for a specific NFT token.
     * @param nftTokenId The ID of the NFT token.
     * @return The amount of ETH liquidity provided by the user for the specified NFT token.
     */
    function getNFTUserETHLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftEthLiquidityProvided[nftTokenId];
    }

    /**
     * @dev Retrieves the amount of USDT liquidity provided by the user for a specific NFT token.
     * @param nftTokenId The ID of the NFT token.
     * @return The amount of USDT liquidity provided by the user for the specified NFT token.
     */
    function getNFTUserUSDTLiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftTokensLiquidityProvided[nftTokenId][address(s_USDTToken)];
    }

    /**
     * @dev Retrieves the amount of DAI liquidity provided by the user for a specific NFT token.
     * @param nftTokenId The ID of the NFT token.
     * @return The amount of DAI liquidity provided by the user for the specified NFT token.
     */
    function getNFTUserDAILiquidityPoolAmount(uint256 nftTokenId) external view returns (uint256) {
        return s_userBalances[msg.sender].nftTokensLiquidityProvided[nftTokenId][address(s_DAIToken)];
    }

    /**
     * @dev Returns the total amount of ETH deposited by the user to Aave.
     * @return The total amount of ETH deposited by the user to Aave.
     */
    function getUserTotalDepositedETHtoAave() external view returns (uint256) {
        return s_userBalances[msg.sender].ethDepositedToAave;
    }

    /**
     * @dev Retrieves the amount of ETH staked by the user.
     * @return The amount of ETH staked by the user.
     */
    function getUserEthStaked() external view returns (uint256) {
        return s_userBalances[msg.sender].ethStaked;
    }

    // PUBLIC FUNCTIONS

    /**
     * @dev Performs a token swap using the Uniswap protocol.
     * @param tokenInAddress The address of the token to be swapped.
     * @param tokenOutAddress The address of the token to receive in the swap.
     * @param amountIn The amount of tokenIn to be swapped.
     */
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

    /**
     * @dev Calculates the amount of governance tokens to be rewarded based on the provided ETH amount.
     * @param ethAmount The amount of ETH to calculate governance tokens for.
     * @return The amount of governance tokens to be rewarded.
     */
    function calculateGovernanceTokensAmount(uint256 ethAmount) public view returns (uint256) {
        uint256 governanceAmount = (ethAmount * s_stakingToGovernancePercentage) / 100;

        return governanceAmount;
    }

    // PRIVATE FUNCTIONS

    /**
     * @dev Processes the liquidity providing for a specific token.
     * @dev This function transfers the specified amount of tokens from the caller to the contract,
     * and updates the liquidityProvidedAmounts mapping with the provided amount.
     * @param token The ERC20 token to provide liquidity for.
     * @param amount The amount of tokens to provide as liquidity.
     * @param tokenAddress The address of the token.
     */
    function _processTokenLiquidityProviding(IERC20 token, uint256 amount, address tokenAddress) private {
        if (amount > 0) {
            if (token.allowance(msg.sender, address(this)) < amount) {
                revert DeFiExchange__InsufficientLiquidityProvidingTokenBalance(address(token), msg.sender, amount);
            }
            token.safeTransferFrom(msg.sender, address(this), amount);
            s_liquidityProvidedAmounts.tokensAmounts[tokenAddress] += amount;
        }
    }

    /**
     * @dev Saves the liquidity provided by a user for a specific NFT token.
     * @param user The address of the user providing liquidity.
     * @param tokenId The ID of the NFT token.
     * @param ethAmount The amount of ETH liquidity provided.
     * @param daiAmount The amount of DAI liquidity provided.
     * @param usdtAmount The amount of USDT liquidity provided.
     */
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

    /**
     * @dev Internal function to process the redemption of token liquidity.
     * @param token The ERC20 token being redeemed.
     * @param user The address of the user redeeming the liquidity.
     * @param amount The amount of tokens being redeemed.
     * @param tokenAddress The address of the token being redeemed.
     * @param tokenId The ID of the NFT token being redeemed.
     */
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

    /**
     * @dev Withdraws tokens from the contract for the calling user.
     * @param token The ERC20 token to withdraw.
     */
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

    /**
     * @dev Deposits a specified amount of tokens into the contract.
     * @param token The ERC20 token to deposit.
     * @param amount The amount of tokens to deposit.
     */
    function _depositToken(IERC20 token, uint256 amount) private {
        address tokenAddress = address(token);
        if (token.allowance(msg.sender, address(this)) < amount) {
            revert DeFiExchange__InsufficientDepositTokenBalance(tokenAddress, msg.sender);
        }
        token.safeTransferFrom(msg.sender, address(this), amount);
        s_userBalances[msg.sender].tokensBalances[tokenAddress] += amount;
        emit TokenDeposited(tokenAddress, msg.sender, amount);
    }

    /**
     * @dev Checks if the given user is the owner of the specified NFT token.
     * @param user The address of the user to check ownership for.
     * @param tokenId The ID of the NFT token to check ownership for.
     * @return A boolean value indicating whether the user is the owner of the NFT token.
     */
    function _isNFTOwner(address user, uint256 tokenId) private view returns (bool) {
        address owner = s_liquidityPoolNFT.ownerOf(tokenId);
        return owner == user;
    }

    /**
     * @dev Calculates the withdrawal fee for a given amount.
     * @param amount The amount for which to calculate the withdrawal fee.
     * @return The withdrawal fee amount.
     */
    function _calculateWithdrawalFee(uint256 amount) private view returns (uint256) {
        uint256 fee = (amount * s_withdrawFeePercentage) / 100;

        return fee;
    }
}
