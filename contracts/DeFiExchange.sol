// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GovernanceToken.sol";


error DeFiExchange__InsufficientDepositDAIBalance();
error DeFiExchange__InsufficientWithdrawDAIBalance();
error DeFiExchange__InsufficientDepositUSDTBalance();
error DeFiExchange__InsufficientWithdrawUSDTBalance();
error DeFiExchange__InsufficientWithdrawETHBalance();
error DeFiExchange__WithdrawETHFail();
error DeFiExchange__InvalidNewWithdrawFeePercentage();
error DeFiExchange__ETHIsNotStaked();
error DeFiExchange__NotEnoughETHForStaking();
error DeFiExchange__WithdrawStakedETHFail();

contract DeFiExchange is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint8 public s_withdrawFeePercentage;
    uint8 public s_stakingToGovernancePercentage;

    IERC20 public s_DAIToken;
    IERC20 public s_USDTToken;
    GovernanceToken public s_governanceToken;

    uint256 public s_totalEthFees = 0;
    mapping(address => uint256) public s_totalTokensFees;
    mapping(address => uint256) public s_totalEthStaking;
    mapping(address => uint256) public s_totalEthBalance;
    mapping(address => mapping(address => uint256)) public s_totalTokensBalance;

    event ETHDeposited(address user, uint256 amount);
    event ETHWithdrawn(address user, uint256 amount);
    event DAIDeposited(address user, uint256 amount);
    event DAIWithdrawn(address user, uint256 amount);
    event USDTDeposited(address user, uint256 amount);
    event USDTWithdrawn(address user, uint256 amount);
    event WithdrawFeePercentageChanged(uint8 newWithdrawFeePercentage);
    event StakedETHForGovernance(address user, uint256 stakingAmount, uint256 governanceAmount);
    event WithdrawStakedETHForGovernance(address user, uint256 stakingAmount, uint256 governanceAmount);

    constructor(
        address DAITokenAddress,
        address USDTTokenAddress,
        address governanceTokenAddress,
        uint8 withdrawFeePercentage,
        uint8 stakingToGovernancePercentage
    ) {
        s_DAIToken = IERC20(DAITokenAddress);
        s_USDTToken = IERC20(USDTTokenAddress);
        s_governanceToken = GovernanceToken(governanceTokenAddress);
        s_withdrawFeePercentage = withdrawFeePercentage;
        s_stakingToGovernancePercentage = stakingToGovernancePercentage;
    }

    function changeWithdrawFeePercentage(uint8 _withdrawFeePercentage) external onlyOwner {
        if (_withdrawFeePercentage > 100) {
            revert DeFiExchange__InvalidNewWithdrawFeePercentage();
        }
        s_withdrawFeePercentage = _withdrawFeePercentage;
        emit WithdrawFeePercentageChanged(s_withdrawFeePercentage);
    }

    // STAKING FUNCTIONS

    function stakeETHForGovernance() external payable nonReentrant {
        uint256 stakingAmount = msg.value;
        if (stakingAmount == 0) {
            revert DeFiExchange__NotEnoughETHForStaking();
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakingAmount);
        s_totalEthStaking[msg.sender] += stakingAmount;
        s_governanceToken.mint(msg.sender, governanceAmount);

        emit StakedETHForGovernance(msg.sender, stakingAmount, governanceAmount);
    }

    function withdrawStakedETHForGovernance() external nonReentrant {
        uint256 stakedAmount = s_totalEthStaking[msg.sender];
        if (stakedAmount == 0) {
            revert DeFiExchange__ETHIsNotStaked();
        }
        uint256 governanceAmount = calculateGovernanceTokensAmount(stakedAmount);
        s_governanceToken.burn(msg.sender, governanceAmount);
        s_totalEthStaking[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: stakedAmount}("");
        if (!success) {
            revert DeFiExchange__WithdrawStakedETHFail();
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
            revert DeFiExchange__InsufficientDepositDAIBalance();
        }

        s_DAIToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalTokensBalance[msg.sender][address(s_DAIToken)] += _amount;
        emit DAIDeposited(msg.sender, _amount);
    }

    function depositUSDT(uint256 _amount) external {
        if (s_USDTToken.allowance(msg.sender, address(this)) < _amount) {
            revert DeFiExchange__InsufficientDepositUSDTBalance();
        }

        s_USDTToken.safeTransferFrom(msg.sender, address(this), _amount);
        s_totalTokensBalance[msg.sender][address(s_USDTToken)] += _amount;
        emit USDTDeposited(msg.sender, _amount);
    }

    // WITHDRAW FUNCTIONS

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

        uint256 totalAmount = s_totalTokensBalance[msg.sender][address(s_DAIToken)];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawDAIBalance();
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalTokensFees[address(s_DAIToken)] += fee;
        s_totalTokensBalance[msg.sender][address(s_DAIToken)] = 0;
        s_DAIToken.safeTransfer(msg.sender, withdrawAmount);
        emit DAIWithdrawn(msg.sender, withdrawAmount);
    }

    function withdrawUSDT() external nonReentrant() {
        uint256 totalAmount = s_totalTokensBalance[msg.sender][address(s_USDTToken)];
        if (totalAmount <= 0) {
            revert DeFiExchange__InsufficientWithdrawUSDTBalance();
        }
        uint256 fee = calculateWithdrawalFee(totalAmount);
        uint256 withdrawAmount = totalAmount - fee;
        s_totalTokensFees[address(s_USDTToken)] += fee;
        s_totalTokensBalance[msg.sender][address(s_USDTToken)] = 0;
        s_USDTToken.safeTransfer(msg.sender, withdrawAmount);
        emit USDTWithdrawn(msg.sender, withdrawAmount);
    }

    function calculateWithdrawalFee(uint256 amount) internal view returns (uint256) {
        uint256 fee = (amount * s_withdrawFeePercentage) / 100;

        return fee;
    }

    // GETTER FUNCTIONS

    function getWithdrawFeePercentage() external view returns (uint8) {
        return s_withdrawFeePercentage;
    }

    function getUserETHBalance(address user) external view returns (uint256) {
        return s_totalEthBalance[user];
    }

    function getUserDAIBalance(address user) external view returns (uint256) {
        return s_totalTokensBalance[user][address(s_DAIToken)];
    }

    function getUserUSDTBalance(address user) external view returns (uint256) {
        return s_totalTokensBalance[user][address(s_USDTToken)];
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
}
