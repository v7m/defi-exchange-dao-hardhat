// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

contract PoolAddressesProviderMock is IPoolAddressesProvider {
    function getMarketId() external pure override returns (string memory) {
        return "MockMarketId";
    }

    function setMarketId(string calldata newMarketId) external override {
        emit MarketIdSet("OldMarketId", newMarketId);
    }

    function getAddress(bytes32 /* id */) external pure override returns (address) {
        return address(0);
    }

    function setAddressAsProxy(bytes32 id, address newImplementationAddress) external override {
        emit AddressSetAsProxy(id, address(0), address(0), newImplementationAddress);
    }

    function setAddress(bytes32 id, address newAddress) external override {
        emit AddressSet(id, address(0), newAddress);
    }

    function getPool() external pure override returns (address) {
        return address(0);
    }

    function setPoolImpl(address newPoolImpl) external override {
        emit ProxyCreated(bytes32(0), address(0), newPoolImpl);
    }

    function getPoolConfigurator() external pure override returns (address) {
        return address(0);
    }

    function setPoolConfiguratorImpl(address newPoolConfiguratorImpl) external override {
        emit ProxyCreated(bytes32(0), address(0), newPoolConfiguratorImpl);
    }

    function getPriceOracle() external pure override returns (address) {
        return address(0);
    }

    function setPriceOracle(address newPriceOracle) external override {
        emit PriceOracleUpdated(address(0), newPriceOracle);
    }

    function getACLManager() external pure override returns (address) {
        return address(0);
    }

    function setACLManager(address newAclManager) external override {
        emit ACLManagerUpdated(address(0), newAclManager);
    }

    function getACLAdmin() external pure override returns (address) {
        return address(0);
    }

    function setACLAdmin(address newAclAdmin) external override {
        emit ACLAdminUpdated(address(0), newAclAdmin);
    }

    function getPriceOracleSentinel() external pure override returns (address) {
        return address(0);
    }

    function setPriceOracleSentinel(address newPriceOracleSentinel) external override {
        emit PriceOracleSentinelUpdated(address(0), newPriceOracleSentinel);
    }

    function getPoolDataProvider() external pure override returns (address) {
        return address(0);
    }

    function setPoolDataProvider(address newDataProvider) external override {
        emit PoolDataProviderUpdated(address(0), newDataProvider);
    }
}
