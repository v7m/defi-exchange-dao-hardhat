// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title DiFiExchangeProxyAdmin
 * @dev A contract that extends the functionality of the ProxyAdmin contract.
 * @dev It is used as the admin contract for the DiFiExchangeProxy contract.
 */
contract DiFiExchangeProxyAdmin is ProxyAdmin {
    constructor(
        address /* owner */
    ) ProxyAdmin() {}

    event Upgraded(address indexed proxy, address indexed implementation, bytes data);

    /**
     * @dev Overrides the upgradeAndCall function to emit an event.
     * @param proxy The proxy to be upgraded.
     * @param newImplementation The address of the new implementation.
     * @param data The calldata to be executed.
     */
    function upgradeAndCall(
        ITransparentUpgradeableProxy proxy,
        address newImplementation,
        bytes memory data
    ) public payable override onlyOwner {
        super.upgradeAndCall(proxy, newImplementation, data);
        emit Upgraded(address(proxy), newImplementation, data);
    }
}
