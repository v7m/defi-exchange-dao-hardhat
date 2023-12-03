// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract TimeLock is TimelockController {
    /**
     * IMPORTANT: The optional admin can aid with initial configuration of roles after deployment
     * without being subject to delay, but this role should be subsequently renounced in favor of
     * administration through timelocked proposals. Previous versions of this contract would assign
     * this admin to the deployer automatically and should be renounced as well.
     */
    constructor(
        uint256 minDelay, // time before executing
        address[] memory proposers, // the list of addresses that can propose
        address[] memory executors, // the list of addresses that can execute
        address admin // optional account to be granted admin role; disable with zero address
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
