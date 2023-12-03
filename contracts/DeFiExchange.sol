// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error DeFiExchange__InsufficientDepositDAIBalance();
error DeFiExchange__InsufficientWithdrawDAIBalance();
error DeFiExchange__InsufficientDepositUSDTBalance();
error DeFiExchange__InsufficientWithdrawUSDTBalance();
error DeFiExchange__InsufficientWithdrawETHBalance();
error DeFiExchange__WithdrawETHFail();

contract DeFiExchange is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public feePercentage = 1;
    uint256 public s_totalEthFees = 0;
    uint256 public s_totalDaiFees = 0;
    uint256 public s_totalUsdtFees = 0;

    IERC20 public s_daiToken;
    IERC20 public s_usdtToken;

    mapping(address => uint256) public s_totalEthBalance;
    mapping(address => uint256) public s_totalDaiBalance;
    mapping(address => uint256) public s_totalUsdtBalance;

    event ETHDeposited(address user, uint256 amount);
    event ETHWithdrawn(address user, uint256 amount);
    event DAIDeposited(address user, uint256 amount);
    event DAIWithdrawn(address user, uint256 amount);
    event USDTDeposited(address user, uint256 amount);
    event USDTWithdrawn(address user, uint256 amount);

    constructor(
        address daiTokenAddress,
        address usdtTokenAddress
    ) {
        s_daiToken = IERC20(daiTokenAddress);
        s_usdtToken = IERC20(usdtTokenAddress);
    }

    function depositETH() external payable {
        s_totalEthBalance[msg.sender] = s_totalEthBalance[msg.sender] + msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }

    function depositDAI(uint256 _amount) external {
        if (s_daiToken.allowance(msg.sender, address(this)) < _amount) {
            revert DeFiExchange__InsufficientDepositDAIBalance();
        }

        s_daiToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalDaiBalance[msg.sender] += _amount;
        emit DAIDeposited(msg.sender, _amount);
    }

    function depositUSDT(uint256 _amount) external {
        if (s_usdtToken.allowance(msg.sender, address(this)) < _amount) {
            revert DeFiExchange__InsufficientDepositUSDTBalance();
        }

        s_usdtToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalUsdtBalance[msg.sender] += _amount;
        emit USDTDeposited(msg.sender, _amount);
    }

    function withdrawETH() external nonReentrant() {
        uint256 totalAmount = s_totalEthBalance[msg.sender];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawETHBalance();
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalEthFees += fee;
        s_totalEthBalance[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawETHFail();
        }
        emit ETHWithdrawn(msg.sender, withdrawAmount);
    }

    function withdrawDAI() external nonReentrant() {
        uint256 totalAmount = s_totalDaiBalance[msg.sender];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawDAIBalance();
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalDaiFees += fee;
        s_totalDaiBalance[msg.sender] = 0;
        s_daiToken.safeTransfer(msg.sender, withdrawAmount);
        emit DAIWithdrawn(msg.sender, withdrawAmount);
    }

    function withdrawUSDT() external nonReentrant() {
        uint256 totalAmount = s_totalUsdtBalance[msg.sender];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawUSDTBalance();
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalUsdtFees += fee;
        s_totalUsdtBalance[msg.sender] = 0;
        s_usdtToken.safeTransfer(msg.sender, withdrawAmount);
        emit USDTWithdrawn(msg.sender, withdrawAmount);
    }


    function calculateWithdrawalFee(uint256 amount) internal view returns (uint256) {
        uint256 fee = (amount * feePercentage) / 100;

        return fee;
    }

    // GETTER FUNCTIONS

    function getUserETHBalance(address user) external view returns (uint256) {
        return s_totalEthBalance[user];
    }

    function getUserDAIBalance(address user) external view returns (uint256) {
        return s_totalDaiBalance[user];
    }

    function getUserUSDTBalance(address user) external view returns (uint256) {
        return s_totalUsdtBalance[user];
    }
}
