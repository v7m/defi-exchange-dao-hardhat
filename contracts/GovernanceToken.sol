// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error GovernanceToken__StakingContractAlreadySet();
error GovernanceToken__AllowedOnlyForSkatingContract();

contract GovernanceToken is ERC20Votes, Ownable {
    address public s_stakingContractAddress;

    event StakingContractSet(address stakingContractAddress);
    event GovernanceTokensMinted(address recipient, uint256 amount);
    event GovernanceTokensBurned(address recipient, uint256 amount);

    modifier onlyStakingContract() {
        if (msg.sender != s_stakingContractAddress) {
            revert GovernanceToken__AllowedOnlyForSkatingContract();
        }
        _;
    }

    constructor() ERC20("GovernanceToken", "GT") ERC20Permit("GovernanceToken") {
        _mint(msg.sender, 1000000 * 10 ** decimals());  // 1 million tokens
    }

    function initialize(address _stakingContractAddress) external onlyOwner {
        if (s_stakingContractAddress != address(0)) {
            revert GovernanceToken__StakingContractAlreadySet();
        }

        s_stakingContractAddress = _stakingContractAddress;
        emit StakingContractSet(_stakingContractAddress);
    }

    function mint(address recipient, uint256 amount) external onlyStakingContract {
        _mint(recipient, amount);
        emit GovernanceTokensMinted(recipient, amount);
    }

    function burn(address recipient, uint256 amount) external onlyStakingContract {
        _burn(recipient, amount);
        emit GovernanceTokensBurned(recipient, amount);
    }

    // The functions below are overrides required by Solidity.

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20Votes) {
        super._burn(account, amount);
    }
}