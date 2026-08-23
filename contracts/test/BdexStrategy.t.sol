// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { GrenTypes } from "../src/core/GrenTypes.sol";
import { GrenVault } from "../src/core/GrenVault.sol";
import { BdexStrategy } from "../src/strategies/BdexStrategy.sol";
import { MockUSDT } from "./mocks/MockUSDT.sol";
import { MockWBOT } from "./mocks/MockWBOT.sol";
import { MockBdexPair, MockBdexRouter } from "./mocks/MockBdex.sol";

contract BdexStrategyTest is Test {
    uint256 internal constant UNIT = 1e6;

    MockUSDT internal usdt;
    MockWBOT internal wbot;
    MockBdexPair internal pair;
    MockBdexRouter internal router;
    GrenVault internal vault;
    BdexStrategy internal strategy;

    address internal owner = address(0x2001);
    address internal policyAdmin = address(0x2002);
    address internal pauser = address(0x2003);
    address internal keeper = address(0x2004);
    address internal alice = address(0x2005);

    function setUp() public {
        usdt = new MockUSDT();
        wbot = new MockWBOT();
        pair = new MockBdexPair(address(usdt), address(wbot), 1_000_000 * 1e6, 1_000_000 * 1e18);
        router = new MockBdexRouter(usdt, wbot);
        usdt.mint(address(router), 10_000_000 * UNIT);
        wbot.mint(address(router), 10_000_000 * 1e18);

        vault = new GrenVault(
            usdt,
            "Gren Aggressive Vault",
            "gUSDT-A",
            2,
            7_000,
            120,
            0,
            300,
            owner,
            policyAdmin,
            pauser,
            keeper,
            true
        );
        strategy = new BdexStrategy(
            address(vault), address(usdt), address(wbot), address(router), address(pair)
        );

        vm.startPrank(policyAdmin);
        vault.setStrategyAllowed(address(strategy), true);
        vault.setInventoryAdapter(address(strategy));
        vm.stopPrank();

        usdt.mint(alice, 1_000 * UNIT);
        vm.startPrank(alice);
        usdt.approve(address(vault), type(uint256).max);
        vault.deposit(100 * UNIT, alice);
        vm.stopPrank();
    }

    function testConstructorEnablesBdexOnAggressiveVault() public view {
        assertTrue(vault.bdexEnabled());
    }

    function testRebalanceSwapsUsdtForWbotWithinCap() public {
        GrenTypes.AllocationDecision memory decision = _decision(3_000, 7_000, 120);

        vm.prank(keeper);
        bool accepted = vault.executeDecision(decision);

        assertTrue(accepted);
        assertEq(vault.currentDexBps(), 7_000);
        assertGt(wbot.balanceOf(address(strategy)), 0);
        assertGt(strategy.dexInventoryUsdt(), 0);
        assertEq(vault.totalAssets(), 100 * UNIT);
    }

    function testWithdrawUnwindsWbotWhenIdleUsdtIsShort() public {
        GrenTypes.AllocationDecision memory decision = _decision(3_000, 7_000, 120);
        vm.prank(keeper);
        vault.executeDecision(decision);

        uint256 before = usdt.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw(100 * UNIT, alice, alice);

        assertEq(usdt.balanceOf(alice), before + 100 * UNIT);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(wbot.balanceOf(address(strategy)), 0);
    }

    function testSlippageRevertLeavesAccountingUnchanged() public {
        // slippageBps (121) exceeds maxSlippageBps (120) so the vault rejects it.
        GrenTypes.AllocationDecision memory decision = _decision(3_000, 7_000, 121);
        uint256 assetsBefore = vault.totalAssets();

        vm.prank(keeper);
        bool accepted = vault.executeDecision(decision);

        assertFalse(accepted);
        assertEq(vault.totalAssets(), assetsBefore);
        assertEq(vault.currentDexBps(), 0);
        assertEq(wbot.balanceOf(address(strategy)), 0);
    }

    function _decision(uint16 reserveBps, uint16 dexBps, uint16 slippageBps)
        internal
        view
        returns (GrenTypes.AllocationDecision memory decision)
    {
        decision.decisionId = keccak256(abi.encode(reserveBps, dexBps, block.timestamp));
        decision.vault = address(vault);
        decision.profile = 2;
        decision.reserveBps = reserveBps;
        decision.dexBps = dexBps;
        decision.slippageBps = slippageBps;
        decision.asset = address(usdt);
        decision.strategy = address(strategy);
        decision.reasonCode = "VOLATILITY_WITHIN_BAND";
        decision.snapshotTotalAssets = vault.totalAssets();
        decision.snapshotTotalShares = vault.totalSupply();
        decision.snapshotReserveBps = vault.currentReserveBps();
        decision.snapshotDexBps = vault.currentDexBps();
        decision.snapshotAt = uint64(block.timestamp);
        decision.expiresAt = uint64(block.timestamp + 100);
        decision.policyVersion = vault.policyVersion();
        decision.inputHash = vault.inputHashFor(
            decision.snapshotTotalAssets,
            decision.snapshotTotalShares,
            decision.snapshotReserveBps,
            decision.snapshotDexBps,
            decision.snapshotAt,
            decision.policyVersion
        );
    }
}
