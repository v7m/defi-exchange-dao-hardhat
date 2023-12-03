// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ERC20TokenMock is IERC20, ERC20Burnable {
    constructor() ERC20("ERC20TokenMock", "ERC20TM") {
        // Mint some initial tokens to the deployer
        _mint(msg.sender, 1000000 * (10**decimals()));
    }
}
