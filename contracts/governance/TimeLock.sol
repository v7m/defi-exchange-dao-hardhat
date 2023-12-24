// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title TimeLock
 * @dev A contract that extends the TimelockController.
 */
contract TimeLock is TimelockController {
    /**
     * @dev Constructor function to initialize the TimeLock contract.
     * @param minDelay The time duration (in seconds) before a proposal can be executed.
     * @param proposers The list of addresses that are allowed to propose new actions.
     * @param executors The list of addresses that are allowed to execute proposed actions.
     * @param admin An optional account that can be granted the admin role. Use a zero address to disable this feature.
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
