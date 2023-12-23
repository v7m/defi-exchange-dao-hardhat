// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract USDTTokenMock is IERC20, ERC20Burnable {
    constructor() ERC20("USDTTokenMock", "USDTM") {
        // Mint some initial tokens to the deployer
        _mint(msg.sender, 1000000 * (10**decimals()));
    }
}
