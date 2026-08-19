// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { GrenTypes } from "../src/core/GrenTypes.sol";
import { GrenVault } from "../src/core/GrenVault.sol";
import { ReserveStrategy } from "../src/strategies/ReserveStrategy.sol";
import { MockUSDT } from "./mocks/MockUSDT.sol";

contract GrenVaultTest is Test {
    uint256 internal constant UNIT = 1e6;

    MockUSDT internal usdt;
    GrenVault internal vault;
    ReserveStrategy internal strategy;

    address internal owner = address(0x1001);
    address internal policyAdmin = address(0x1002);
    address internal pauser = address(0x1003);
    address internal keeper = address(0x1004);
    address internal alice = address(0x1005);
    address internal bob = address(0x1006);
    address internal newOwner = address(0x1007);

    function setUp() public {
        usdt = new MockUSDT();
        vault = new GrenVault(
            usdt,
            "Gren Balanced Vault",
            "gUSDT-B",
            1,
            4_500,
            80,
            100,
            300,
            owner,
            policyAdmin,
            pauser,
            keeper
        );
        strategy = new ReserveStrategy(address(vault), address(usdt));

        vm.prank(policyAdmin);
        vault.setStrategyAllowed(address(strategy), true);

        usdt.mint(alice, 1_000 * UNIT);
        usdt.mint(bob, 1_000 * UNIT);
    }

    function testDepositMintWithdrawAndRedeem() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 1_000 * UNIT);
        uint256 depositedShares = vault.deposit(100 * UNIT, alice);
        uint256 mintedAssets = vault.mint(10 * UNIT, alice);
        uint256 withdrawnShares = vault.withdraw(25 * UNIT, alice, alice);
        uint256 redeemedAssets = vault.redeem(5 * UNIT, alice, alice);
        vm.stopPrank();

        assertGt(depositedShares, 0);
        assertGt(mintedAssets, 0);
        assertGt(withdrawnShares, 0);
        assertGt(redeemedAssets, 0);
        assertEq(vault.totalAssets(), usdt.balanceOf(address(vault)));
        assertEq(vault.totalSupply(), vault.balanceOf(alice));
    }

    function testTwoUsersCannotWithdrawEachOthersShares() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 100 * UNIT);
        vault.deposit(100 * UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(vault), 100 * UNIT);
        vault.deposit(100 * UNIT, bob);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.expectRevert();
        vault.redeem(aliceShares, bob, alice);
        vm.stopPrank();

        assertGt(vault.balanceOf(alice), 0);
        assertGt(vault.balanceOf(bob), 0);
    }

    function testAllowedReserveDecisionUpdatesState() public {
        GrenTypes.AllocationDecision memory decision =
            _decision(keccak256("allowed"), 10_000, 0, 0, block.timestamp + 100);

        vm.prank(keeper);
        bool accepted = vault.executeDecision(decision);

        assertTrue(accepted);
        assertTrue(vault.decisionUsed(decision.decisionId));
        assertEq(vault.currentReserveBps(), 10_000);
        assertEq(vault.currentDexBps(), 0);
        assertEq(vault.lastDecisionAt(), block.timestamp);
    }

    function testKeeperCannotExecuteOutOfBoundsDecision() public {
        GrenTypes.AllocationDecision memory decision =
            _decision(keccak256("out-of-bounds"), 5_499, 4_501, 0, block.timestamp + 100);
        bytes32 beforeHash = vault.inputHashFor(
            decision.snapshotTotalAssets,
            decision.snapshotTotalShares,
            decision.snapshotReserveBps,
            decision.snapshotDexBps,
            decision.snapshotAt,
            decision.policyVersion
        );

        vm.prank(keeper);
        bool accepted = vault.executeDecision(decision);

        assertFalse(accepted);
        assertFalse(vault.decisionUsed(decision.decisionId));
        assertEq(vault.lastDecisionAt(), 0);
        assertEq(beforeHash, decision.inputHash);
    }

    function testBdexAllocationIsRejectedEvenWithinProfileCap() public {
        GrenTypes.AllocationDecision memory decision =
            _decision(keccak256("bdex-disabled"), 9_999, 1, 0, block.timestamp + 100);

        (bool valid, bytes32 reason) = vault.validateDecision(decision);

        assertFalse(valid);
        assertEq(reason, vault.REASON_BDEX_DISABLED());
    }

    function testRejectedDecisionDoesNotConsumeIdOrChangeAccounting() public {
        GrenTypes.AllocationDecision memory decision =
            _decision(keccak256("bad-total"), 9_000, 999, 0, block.timestamp + 100);
        uint256 assetsBefore = vault.totalAssets();
        uint256 sharesBefore = vault.totalSupply();

        vm.prank(keeper);
        bool accepted = vault.executeDecision(decision);

        assertFalse(accepted);
        assertFalse(vault.decisionUsed(decision.decisionId));
        assertEq(vault.totalAssets(), assetsBefore);
        assertEq(vault.totalSupply(), sharesBefore);
    }

    function testExpiredStaleAndReplayDecisionsAreRejected() public {
        GrenTypes.AllocationDecision memory expired =
            _decision(keccak256("expired"), 10_000, 0, 0, block.timestamp);
        (bool expiredValid, bytes32 expiredReason) = vault.validateDecision(expired);
        assertFalse(expiredValid);
        assertEq(expiredReason, vault.REASON_DECISION_EXPIRED());

        GrenTypes.AllocationDecision memory stale =
            _decision(keccak256("stale"), 10_000, 0, 0, block.timestamp + 100);
        usdt.mint(bob, UNIT);
        vm.startPrank(bob);
        usdt.approve(address(vault), UNIT);
        vault.deposit(UNIT, bob);
        vm.stopPrank();

        (bool staleValid, bytes32 staleReason) = vault.validateDecision(stale);
        assertFalse(staleValid);
        assertEq(staleReason, vault.REASON_INPUT_STALE());

        GrenTypes.AllocationDecision memory allowed =
            _decision(keccak256("replay"), 10_000, 0, 0, block.timestamp + 100);
        vm.prank(keeper);
        assertTrue(vault.executeDecision(allowed));
        vm.prank(keeper);
        assertFalse(vault.executeDecision(allowed));
        assertTrue(vault.decisionUsed(allowed.decisionId));
    }

    function testCooldownAndPolicyAdminUpdates() public {
        GrenTypes.AllocationDecision memory first =
            _decision(keccak256("cooldown-first"), 10_000, 0, 0, block.timestamp + 100);
        vm.prank(keeper);
        assertTrue(vault.executeDecision(first));

        GrenTypes.AllocationDecision memory second =
            _decision(keccak256("cooldown-second"), 10_000, 0, 0, block.timestamp + 100);
        (bool valid, bytes32 reason) = vault.validateDecision(second);
        assertFalse(valid);
        assertEq(reason, vault.REASON_COOLDOWN_ACTIVE());

        uint64 oldVersion = vault.policyVersion();
        vm.prank(policyAdmin);
        vault.setPolicy(4_000, 70, 0, 600);
        assertEq(vault.maxDexBps(), 4_000);
        assertEq(vault.maxSlippageBps(), 70);
        assertEq(vault.policyVersion(), oldVersion + 1);
    }

    function testPauseBlocksDepositsButNotWithdrawals() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 100 * UNIT);
        vault.deposit(100 * UNIT, alice);
        vm.stopPrank();

        vm.prank(pauser);
        vault.pause();

        vm.startPrank(alice);
        vm.expectRevert();
        vault.deposit(1 * UNIT, alice);
        uint256 balanceBefore = usdt.balanceOf(alice);
        vault.withdraw(10 * UNIT, alice, alice);
        vm.stopPrank();

        assertGt(usdt.balanceOf(alice), balanceBefore);
        assertTrue(vault.paused());
    }

    function testOnlyPolicyAdminCanChangeStrategyAllowlist() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setStrategyAllowed(address(strategy), false);

        vm.prank(policyAdmin);
        vault.setStrategyAllowed(address(strategy), false);
        assertFalse(vault.strategyAllowed(address(strategy)));
    }

    function testOwnershipTransferMovesDefaultAdminRole() public {
        vm.prank(owner);
        vault.transferOwnership(newOwner);

        assertEq(vault.owner(), owner);
        assertEq(vault.pendingOwner(), newOwner);
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner));
        assertFalse(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), newOwner));

        vm.prank(newOwner);
        vault.acceptOwnership();

        assertEq(vault.owner(), newOwner);
        assertFalse(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), newOwner));

        bytes32 pauserRole = vault.PAUSER_ROLE();
        vm.expectRevert();
        vm.prank(owner);
        vault.grantRole(pauserRole, alice);

        vm.prank(newOwner);
        vault.grantRole(pauserRole, alice);
        assertTrue(vault.hasRole(pauserRole, alice));
    }

    function testInputHashMismatchIsRejected() public {
        GrenTypes.AllocationDecision memory decision =
            _decision(keccak256("hash-mismatch"), 10_000, 0, 0, block.timestamp + 100);
        decision.inputHash = keccak256("wrong");

        (bool valid, bytes32 reason) = vault.validateDecision(decision);

        assertFalse(valid);
        assertEq(reason, vault.REASON_INPUT_HASH_MISMATCH());
    }

    function _decision(
        bytes32 id,
        uint16 reserveBps,
        uint16 dexBps,
        uint16 slippageBps,
        uint256 expiry
    ) internal view returns (GrenTypes.AllocationDecision memory decision) {
        decision.decisionId = id;
        decision.vault = address(vault);
        decision.profile = 1;
        decision.reserveBps = reserveBps;
        decision.dexBps = dexBps;
        decision.slippageBps = slippageBps;
        decision.asset = address(usdt);
        decision.strategy = address(strategy);
        decision.reasonCode = vault.REASON_RESERVE_ONLY();
        decision.snapshotTotalAssets = vault.totalAssets();
        decision.snapshotTotalShares = vault.totalSupply();
        decision.snapshotReserveBps = vault.currentReserveBps();
        decision.snapshotDexBps = vault.currentDexBps();
        decision.snapshotAt = uint64(block.timestamp);
        decision.expiresAt = uint64(expiry);
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
