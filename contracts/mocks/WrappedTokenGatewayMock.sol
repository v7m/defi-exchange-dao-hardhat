// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@aave/periphery-v3/contracts/misc/interfaces/IWrappedTokenGatewayV3.sol";

contract WrappedTokenGatewayMock is IWrappedTokenGatewayV3 {
    // Mock storage for testing purposes
    mapping(address => uint256) public userBalances;

    function depositETH(address, address onBehalfOf, uint16 referralCode) external payable override {}

    function withdrawETH(address, uint256 amount, address to) external override {}

    function repayETH(
        address,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external payable override {}

    function borrowETH(
        address,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode
    ) external override {}

    function withdrawETHWithPermit(
        address,
        uint256 amount,
        address to,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external override {}
}
