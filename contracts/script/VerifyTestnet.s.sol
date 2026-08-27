// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IBdexPair, IBdexRouter } from "../src/interfaces/IBdexRouter.sol";
import { GrenVault } from "../src/core/GrenVault.sol";
import { BdexStrategy } from "../src/strategies/BdexStrategy.sol";
import { ReserveStrategy } from "../src/strategies/ReserveStrategy.sol";

interface IUniV2RouterView {
    function factory() external view returns (address);

    function WETH() external view returns (address);
}

contract VerifyTestnet is Script {
    uint256 internal constant TARGET_CHAIN_ID = 968;
    address internal constant TARGET_USDT = 0x75edC9335175Fc0552D51D48439F229c10420fe3;
    address internal constant TARGET_WBOT = 0xD5452816194a3784dBa983426cCe7c122F4abd30;
    address internal constant TARGET_BDEX_ROUTER = 0xD6425a02f0845B8D99e349C34D2E7A576E177345;
    address internal constant TARGET_BDEX_FACTORY = 0x65b8e98ceA190d8c28B3e4716402027f634d15a3;
    address internal constant TARGET_BDEX_PAIR = 0xD3EC267707BA234583645E75CE283Cf679dd94Fa;
    uint64 internal constant EXPECTED_COOLDOWN = 1 hours;
    uint64 internal constant EXPECTED_INPUT_AGE = 15 minutes;
    uint256 internal constant MIN_USDT_RESERVE = 1_000 * 1e6;

    error VerificationFailed(string reason);

    function run() external {
        if (block.chainid != TARGET_CHAIN_ID) revert VerificationFailed("wrong chain");

        address usdt = vm.envAddress("TESTNET_USDT_ADDRESS");
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
        _verifyBdexRoute(usdt);

        _verifyVault(
            vm.envAddress("CONSERVATIVE_VAULT_ADDRESS"),
            vm.envAddress("CONSERVATIVE_RESERVE_STRATEGY_ADDRESS"),
            address(0),
            0,
            2_500,
            50,
            false,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );
        _verifyVault(
            vm.envAddress("BALANCED_VAULT_ADDRESS"),
            vm.envAddress("BALANCED_RESERVE_STRATEGY_ADDRESS"),
            address(0),
            1,
            4_500,
            80,
            false,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );
        _verifyVault(
            vm.envAddress("AGGRESSIVE_VAULT_ADDRESS"),
            vm.envAddress("AGGRESSIVE_RESERVE_STRATEGY_ADDRESS"),
            vm.envAddress("AGGRESSIVE_BDEX_STRATEGY_ADDRESS"),
            2,
            7_000,
            120,
            true,
            owner,
            policyAdmin,
            pauser,
            keeper,
            usdt
        );

        console2.log("BOT Chain Testnet deployment verification passed");
    }

    function _verifyBdexRoute(address usdt) internal view {
        if (
            TARGET_WBOT.code.length == 0 || TARGET_BDEX_ROUTER.code.length == 0
                || TARGET_BDEX_FACTORY.code.length == 0 || TARGET_BDEX_PAIR.code.length == 0
        ) revert VerificationFailed("missing BDEX bytecode");
        if (IERC20Metadata(TARGET_WBOT).decimals() != 18) {
            revert VerificationFailed("invalid WBOT decimals");
        }

        IUniV2RouterView routerView = IUniV2RouterView(TARGET_BDEX_ROUTER);
        if (routerView.factory() != TARGET_BDEX_FACTORY || routerView.WETH() != TARGET_WBOT) {
            revert VerificationFailed("BDEX router identity mismatch");
        }

        IBdexPair pair = IBdexPair(TARGET_BDEX_PAIR);
        address token0 = pair.token0();
        address token1 = pair.token1();
        bool usdtWbotPair =
            (token0 == usdt && token1 == TARGET_WBOT) || (token1 == usdt && token0 == TARGET_WBOT);
        if (!usdtWbotPair) revert VerificationFailed("BDEX pair tokens mismatch");

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 usdtReserve = token0 == usdt ? uint256(reserve0) : uint256(reserve1);
        uint256 wbotReserve = token0 == TARGET_WBOT ? uint256(reserve0) : uint256(reserve1);
        if (usdtReserve < MIN_USDT_RESERVE || wbotReserve == 0) {
            revert VerificationFailed("BDEX liquidity too low");
        }

        address[] memory path = new address[](2);
        path[0] = usdt;
        path[1] = TARGET_WBOT;
        uint256[] memory quoted = IBdexRouter(TARGET_BDEX_ROUTER).getAmountsOut(1e6, path);
        if (quoted.length != 2 || quoted[1] == 0) {
            revert VerificationFailed("BDEX quote path failed");
        }
    }

    function _verifyVault(
        address vaultAddress,
        address strategyAddress,
        address bdexStrategyAddress,
        uint8 expectedProfile,
        uint16 expectedMaxDexBps,
        uint16 expectedMaxSlippageBps,
        bool expectedBdexEnabled,
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
        if (
            vault.asset() != usdt || vault.profile() != expectedProfile
                || vault.bdexEnabled() != expectedBdexEnabled
        ) {
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

        if (expectedBdexEnabled) {
            if (bdexStrategyAddress == address(0) || bdexStrategyAddress.code.length == 0) {
                revert VerificationFailed("missing BDEX strategy bytecode");
            }
            if (!vault.strategyAllowed(bdexStrategyAddress)) {
                revert VerificationFailed("BDEX strategy is not allowlisted");
            }
            if (vault.inventoryAdapter() != bdexStrategyAddress) {
                revert VerificationFailed("inventory adapter mismatch");
            }
            BdexStrategy bdex = BdexStrategy(bdexStrategyAddress);
            if (
                bdex.vault() != vaultAddress || bdex.asset() != usdt || bdex.wbot() != TARGET_WBOT
                    || address(bdex.router()) != TARGET_BDEX_ROUTER
                    || address(bdex.pair()) != TARGET_BDEX_PAIR
            ) revert VerificationFailed("BDEX strategy identity mismatch");
        } else if (vault.inventoryAdapter() != address(0)) {
            revert VerificationFailed("inventory adapter should be unset");
        }
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
