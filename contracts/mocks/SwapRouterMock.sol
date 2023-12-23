// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract SwapRouterMock is ISwapRouter {
    function exactInputSingle(
        ExactInputSingleParams calldata /* params */
    ) external payable override returns (uint256 amountOut) {
        amountOut = 0;
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {}

    function exactInput(
        ExactInputParams calldata /* params */
    ) external payable override returns (uint256 amountOut) {
        amountOut = 0;
    }

    function exactOutputSingle(
        ExactOutputSingleParams calldata /* params */
    ) external payable override returns (uint256 amountIn) {
        amountIn = 0;
    }

    function exactOutput(
        ExactOutputParams calldata /* params */
    ) external payable override returns (uint256 amountIn) {
        amountIn = 0;
    }
}
