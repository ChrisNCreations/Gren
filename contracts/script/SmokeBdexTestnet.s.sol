// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GrenTypes } from "../src/core/GrenTypes.sol";
import { GrenVault } from "../src/core/GrenVault.sol";
import { BdexStrategy } from "../src/strategies/BdexStrategy.sol";

/// @dev Live Phase 3 exit-gate: deposit → BDEX rebalance → withdraw that forces unwind.
contract SmokeBdexTestnet is Script {
    uint256 internal constant TARGET_CHAIN_ID = 968;
    uint256 internal constant DEPOSIT_ASSETS = 10 * 1e6;
    uint256 internal constant WITHDRAW_ASSETS = 6 * 1e6;
    uint16 internal constant RESERVE_BPS = 3_000;
    uint16 internal constant DEX_BPS = 7_000;
    uint16 internal constant SLIPPAGE_BPS = 120;

    error SmokeFailed(string reason);

    function run() external {
        if (block.chainid != TARGET_CHAIN_ID) revert SmokeFailed("wrong chain");

        address vaultAddress = vm.envAddress("AGGRESSIVE_VAULT_ADDRESS");
        address strategyAddress = vm.envAddress("AGGRESSIVE_BDEX_STRATEGY_ADDRESS");
        uint256 depositorKey = vm.envOr("SMOKE_PRIVATE_KEY", uint256(0));
        if (depositorKey == 0) depositorKey = vm.envUint("KEEPER_PRIVATE_KEY");
        uint256 keeperKey = vm.envUint("KEEPER_PRIVATE_KEY");
        address depositor = vm.addr(depositorKey);
        address keeper = vm.addr(keeperKey);

        GrenVault vault = GrenVault(vaultAddress);
        BdexStrategy strategy = BdexStrategy(strategyAddress);
        IERC20 usdt = IERC20(vault.asset());

        if (!vault.bdexEnabled()) revert SmokeFailed("aggressive vault BDEX disabled");
        if (vault.inventoryAdapter() != strategyAddress) revert SmokeFailed("adapter mismatch");
        if (!vault.strategyAllowed(strategyAddress)) {
            revert SmokeFailed("strategy not allowlisted");
        }
        if (!vault.hasRole(vault.KEEPER_ROLE(), keeper)) revert SmokeFailed("keeper role missing");
        if (usdt.balanceOf(depositor) < DEPOSIT_ASSETS) {
            revert SmokeFailed("depositor needs 10 USDT");
        }

        vm.startBroadcast(depositorKey);
        usdt.approve(vaultAddress, DEPOSIT_ASSETS);
        uint256 shares = vault.deposit(DEPOSIT_ASSETS, depositor);
        vm.stopBroadcast();
        if (shares == 0) revert SmokeFailed("deposit minted zero shares");

        GrenTypes.AllocationDecision memory decision = _decision(vault, strategyAddress);
        vm.startBroadcast(keeperKey);
        bool accepted = vault.executeDecision(decision);
        vm.stopBroadcast();
        if (!accepted) revert SmokeFailed("rebalance rejected");
        if (vault.currentDexBps() != DEX_BPS) revert SmokeFailed("dex allocation not set");
        if (strategy.dexInventoryUsdt() == 0) revert SmokeFailed("no WBOT inventory after swap");

        uint256 idleBeforeWithdraw = usdt.balanceOf(vaultAddress);
        if (idleBeforeWithdraw >= WITHDRAW_ASSETS) {
            revert SmokeFailed("idle USDT covers withdraw; unwind not forced");
        }

        uint256 usdtBefore = usdt.balanceOf(depositor);
        vm.startBroadcast(depositorKey);
        vault.withdraw(WITHDRAW_ASSETS, depositor, depositor);
        vm.stopBroadcast();
        if (usdt.balanceOf(depositor) != usdtBefore + WITHDRAW_ASSETS) {
            revert SmokeFailed("withdraw did not return USDT");
        }

        console2.log("Phase 3 BDEX smoke passed");
        console2.log("depositor", depositor);
        console2.log("vault", vaultAddress);
        console2.log("bdexStrategy", strategyAddress);
        console2.log("idleBeforeWithdraw", idleBeforeWithdraw);
        console2.log(
            "wbotInventoryAfterWithdraw", IERC20(strategy.wbot()).balanceOf(strategyAddress)
        );
    }

    function _decision(GrenVault vault, address strategyAddress)
        internal
        view
        returns (GrenTypes.AllocationDecision memory decision)
    {
        decision.decisionId = keccak256(abi.encode("phase3-bdex-smoke", vault, block.timestamp));
        decision.vault = address(vault);
        decision.profile = vault.profile();
        decision.reserveBps = RESERVE_BPS;
        decision.dexBps = DEX_BPS;
        decision.slippageBps = SLIPPAGE_BPS;
        decision.asset = vault.asset();
        decision.strategy = strategyAddress;
        decision.reasonCode = "VOLATILITY_WITHIN_BAND";
        decision.snapshotTotalAssets = vault.totalAssets();
        decision.snapshotTotalShares = vault.totalSupply();
        decision.snapshotReserveBps = vault.currentReserveBps();
        decision.snapshotDexBps = vault.currentDexBps();
        decision.snapshotAt = uint64(block.timestamp);
        decision.expiresAt = uint64(block.timestamp + 300);
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
