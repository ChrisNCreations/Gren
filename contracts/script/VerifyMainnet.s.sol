// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { GrenVault } from "../src/core/GrenVault.sol";
import { ReserveStrategy } from "../src/strategies/ReserveStrategy.sol";

contract VerifyMainnet is Script {
    uint256 internal constant TARGET_CHAIN_ID = 677;
    address internal constant TARGET_USDT = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;
    uint64 internal constant EXPECTED_COOLDOWN = 1 hours;
    uint64 internal constant EXPECTED_INPUT_AGE = 15 minutes;

    error VerificationFailed(string reason);

    function run() external {
        if (block.chainid != TARGET_CHAIN_ID) revert VerificationFailed("wrong chain");

        address usdt = vm.envAddress("MAINNET_USDT_ADDRESS");
        if (usdt != TARGET_USDT || usdt.code.length == 0) {
            revert VerificationFailed("wrong USDT");
        }
        if (
            IERC20Metadata(usdt).decimals() != 6
                || _hash(IERC20Metadata(usdt).symbol()) != _hash("USDT")
        ) {
            revert VerificationFailed("invalid USDT metadata");
        }

        address owner = vm.envAddress("GREN_OWNER_ADDRESS");
        address policyAdmin = vm.envAddress("GREN_POLICY_ADMIN_ADDRESS");
        address pauser = vm.envAddress("GREN_PAUSER_ADDRESS");
        address keeper = vm.envAddress("GREN_KEEPER_ADDRESS");
        _verifyRoleSeparation(owner, policyAdmin, pauser, keeper);

        _verifyVault(
            vm.envAddress("CONSERVATIVE_VAULT_ADDRESS"),
            vm.envAddress("CONSERVATIVE_RESERVE_STRATEGY_ADDRESS"),
            0,
            2_500,
            50,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );
        _verifyVault(
            vm.envAddress("BALANCED_VAULT_ADDRESS"),
            vm.envAddress("BALANCED_RESERVE_STRATEGY_ADDRESS"),
            1,
            4_500,
            80,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );
        _verifyVault(
            vm.envAddress("AGGRESSIVE_VAULT_ADDRESS"),
            vm.envAddress("AGGRESSIVE_RESERVE_STRATEGY_ADDRESS"),
            2,
            7_000,
            120,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );

        console2.log("BOT Chain Mainnet deployment verification passed");
    }

    function _verifyVault(
        address vaultAddress,
        address strategyAddress,
        uint8 expectedProfile,
        uint16 expectedMaxDexBps,
        uint16 expectedMaxSlippageBps,
        address owner,
        address policyAdmin,
        address pauser,
        address keeper,
        address usdt
    ) internal view {
        if (vaultAddress.code.length == 0 || strategyAddress.code.length == 0) {
            revert VerificationFailed("missing vault or strategy bytecode");
        }

        GrenVault vault = GrenVault(vaultAddress);
        ReserveStrategy strategy = ReserveStrategy(strategyAddress);
        if (vault.asset() != usdt || vault.profile() != expectedProfile || vault.bdexEnabled()) {
            revert VerificationFailed("vault identity mismatch");
        }
        if (
            vault.maxDexBps() != expectedMaxDexBps
                || vault.maxSlippageBps() != expectedMaxSlippageBps
                || vault.rebalanceCooldown() != EXPECTED_COOLDOWN
                || vault.maxInputAge() != EXPECTED_INPUT_AGE
        ) revert VerificationFailed("vault policy mismatch");
        if (vault.currentReserveBps() != vault.TOTAL_BPS() || vault.currentDexBps() != 0) {
            revert VerificationFailed("vault allocation mismatch");
        }
        if (!vault.strategyAllowed(strategyAddress)) {
            revert VerificationFailed("strategy is not allowlisted");
        }
        if (strategy.vault() != vaultAddress || strategy.asset() != usdt) {
            revert VerificationFailed("strategy identity mismatch");
        }
        if (
            vault.owner() != owner || !vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), owner)
                || !vault.hasRole(vault.POLICY_ADMIN_ROLE(), policyAdmin)
                || !vault.hasRole(vault.PAUSER_ROLE(), pauser)
                || !vault.hasRole(vault.KEEPER_ROLE(), keeper)
        ) revert VerificationFailed("role configuration mismatch");
    }

    function _verifyRoleSeparation(
        address owner,
        address policyAdmin,
        address pauser,
        address keeper
    ) internal pure {
        if (
            owner == address(0) || policyAdmin == address(0) || pauser == address(0)
                || keeper == address(0) || owner == policyAdmin || owner == pauser
                || owner == keeper || policyAdmin == pauser || policyAdmin == keeper
                || pauser == keeper
        ) revert VerificationFailed("roles must be distinct nonzero addresses");
    }

    function _hash(string memory value) private pure returns (bytes32) {
        return keccak256(bytes(value));
    }
}
