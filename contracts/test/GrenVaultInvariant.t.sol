// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { GrenVault } from "../src/core/GrenVault.sol";
import { MockUSDT } from "./mocks/MockUSDT.sol";

contract GrenVaultHandler {
    MockUSDT internal immutable token;
    GrenVault internal immutable vault;

    constructor(MockUSDT token_, GrenVault vault_) {
        token = token_;
        vault = vault_;
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        uint256 assets = amount % 1_000_000_000 + 1;
        token.mint(address(this), assets);
        vault.deposit(assets, address(this));
    }

    function redeemSome() external {
        uint256 shares = vault.balanceOf(address(this));
        if (shares > 0) vault.redeem(shares / 2 + 1, address(this), address(this));
    }
}

contract GrenVaultInvariantTest is StdInvariant, Test {
    MockUSDT internal token;
    GrenVault internal vault;
    GrenVaultHandler internal handler;

    function setUp() public {
        token = new MockUSDT();
        vault = new GrenVault(
            token,
            "Gren Conservative Vault",
            "gUSDT-C",
            0,
            2_500,
            50,
            0,
            300,
            address(this),
            address(this),
            address(this),
            address(this),
            false
        );
        handler = new GrenVaultHandler(token, vault);
        targetContract(address(handler));
    }

    function invariantVaultAssetsMatchTokenBalance() public view {
        assertEq(vault.totalAssets(), token.balanceOf(address(vault)));
        assertEq(
            uint256(vault.currentReserveBps()) + uint256(vault.currentDexBps()),
            uint256(vault.TOTAL_BPS())
        );
        assertEq(vault.totalSupply(), vault.balanceOf(address(handler)));
    }
}
