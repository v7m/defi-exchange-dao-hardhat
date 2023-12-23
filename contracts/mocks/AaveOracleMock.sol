// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/interfaces/IAaveOracle.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

contract AaveOracleMock is IAaveOracle {
    function ADDRESSES_PROVIDER() external pure override returns (IPoolAddressesProvider) {
        return IPoolAddressesProvider(address(0));
    }

    function setAssetSources(address[] calldata assets,address[] calldata sources) external override {}

    function setFallbackOracle(address fallbackOracle) external override {}

    function getAssetsPrices(address[] calldata /* asset */) external pure override returns (uint256[] memory) {
        return new uint256[](0);
    }

    function getSourceOfAsset(address /* asset */) external pure override returns (address) {
        return address(0);
    }

    function getFallbackOracle() external pure override returns (address) {
        return address(0);
    }

    function BASE_CURRENCY() external pure override returns (address) {
        return address(0);
    }

    function BASE_CURRENCY_UNIT() external pure override returns (uint256) {
        return 0;
    }

    function getAssetPrice(address /* asset */) external pure returns (uint256) {
        return 0;
    }
}