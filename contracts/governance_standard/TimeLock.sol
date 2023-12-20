// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract TimeLock is TimelockController {
    constructor(
        uint256 minDelay, // time before executing
        address[] memory proposers, // the list of addresses that can propose
        address[] memory executors, // the list of addresses that can execute
        address admin // optional account to be granted admin role; disable with zero address
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
