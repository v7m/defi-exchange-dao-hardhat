// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error GovernanceToken__StakingContractAlreadySet();
error GovernanceToken__AllowedOnlyForSkatingContract();

/**
 * @title GovernanceToken
 * @dev A contract representing a governance token with staking functionality.
 */
contract GovernanceToken is ERC20Votes, Ownable {
    bool private s_initialized;
    address public s_stakingContractAddress;

    event StakingContractSet(address indexed stakingContractAddress);
    event GovernanceTokensMinted(address indexed recipient, uint256 amount);
    event GovernanceTokensBurned(address indexed recipient, uint256 amount);

    /**
     * @dev Modifier to restrict access to only the staking contract.
     */
    modifier onlyStakingContract() {
        if (msg.sender != s_stakingContractAddress) {
            revert GovernanceToken__AllowedOnlyForSkatingContract();
        }
        _;
    }

    /**
     * @dev Constructor function. Initializes the governance token with an initial supply of 1 million tokens.
     */
    constructor() ERC20("GovernanceToken", "GT") ERC20Permit("GovernanceToken") {
        _mint(msg.sender, 1000000 * 10 ** decimals());  // 1 million tokens
    }

    /**
     * @dev Initializes the staking contract address.
     * @param _stakingContractAddress The address of the staking contract.
     */
    function initialize(address _stakingContractAddress) external onlyOwner {
        if (s_initialized) {
            revert GovernanceToken__StakingContractAlreadySet();
        }

        s_stakingContractAddress = _stakingContractAddress;
        s_initialized = true;
        emit StakingContractSet(_stakingContractAddress);
    }

    /**
     * @dev Mints new governance tokens and assigns them to the recipient.
     * @param recipient The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address recipient, uint256 amount) external onlyStakingContract {
        _mint(recipient, amount);
        emit GovernanceTokensMinted(recipient, amount);
    }

    /**
     * @dev Burns existing governance tokens from the recipient's balance.
     * @param recipient The address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burn(address recipient, uint256 amount) external onlyStakingContract {
        _burn(recipient, amount);
        emit GovernanceTokensBurned(recipient, amount);
    }

    // The functions below are overrides required by Solidity.

    /**
     * @dev This function is called after a token transfer occurs.
     * @param from The address from which the tokens are transferred.
     * @param to The address to which the tokens are transferred.
     * @param amount The amount of tokens transferred.
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    /**
     * @dev This function is used to mint new tokens.
     * @param to The address to which the tokens are minted.
     * @param amount The amount of tokens to be minted.
     */
    function _mint(address to, uint256 amount) internal override(ERC20Votes) {
        super._mint(to, amount);
    }

    /**
     * @dev This function is used to burn tokens.
     * @param account The address from which the tokens are burned.
     * @param amount The amount of tokens to be burned.
     */
    function _burn(address account, uint256 amount) internal override(ERC20Votes) {
        super._burn(account, amount);
    }
}