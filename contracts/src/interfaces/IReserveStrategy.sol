// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IReserveStrategy {
    function asset() external view returns (address);

    function vault() external view returns (address);

    function rebalance(uint16 reserveBps, uint16 dexBps, uint16 slippageBps) external;

    function unwind(uint256 usdtNeeded) external;

    function dexInventoryUsdt() external view returns (uint256);
}
