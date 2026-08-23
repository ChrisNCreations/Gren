// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IReserveStrategy } from "../interfaces/IReserveStrategy.sol";

contract ReserveStrategy is IReserveStrategy {
    address public immutable override asset;
    address public immutable override vault;

    error InvalidReserveAllocation();
    error OnlyVault();

    event ReserveMaintained(uint16 reserveBps, uint16 dexBps);

    constructor(address vault_, address asset_) {
        if (vault_ == address(0) || asset_ == address(0)) revert InvalidReserveAllocation();
        vault = vault_;
        asset = asset_;
    }

    function rebalance(uint16 reserveBps, uint16 dexBps, uint16 slippageBps) external override {
        if (msg.sender != vault) revert OnlyVault();
        if (reserveBps != 10_000 || dexBps != 0 || slippageBps != 0) {
            revert InvalidReserveAllocation();
        }

        // Reserve mode deliberately performs no external protocol call and keeps
        // the underlying token in the vault for direct user withdrawals.
        emit ReserveMaintained(reserveBps, dexBps);
    }

    function unwind(uint256) external override {
        if (msg.sender != vault) revert OnlyVault();
        // Reserve mode holds all USDT idle in the vault; there is nothing to unwind.
    }

    function dexInventoryUsdt() external view override returns (uint256) {
        return 0;
    }
}
