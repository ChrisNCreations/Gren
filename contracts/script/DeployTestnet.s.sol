// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { GrenVault } from "../src/core/GrenVault.sol";
import { ReserveStrategy } from "../src/strategies/ReserveStrategy.sol";

contract DeployTestnet is Script {
    uint256 internal constant TARGET_CHAIN_ID = 968;
    address internal constant TARGET_USDT = 0x75edC9335175Fc0552D51D48439F229c10420fe3;
    uint64 internal constant COOLDOWN_SECONDS = 1 hours;
    uint64 internal constant MAX_INPUT_AGE_SECONDS = 15 minutes;

    error WrongNetwork(uint256 actualChainId);
    error WrongUsdt(address actual);
    error InvalidUsdt();
    error InvalidRoles();

    function run() external {
        if (block.chainid != TARGET_CHAIN_ID) revert WrongNetwork(block.chainid);

        address usdt = vm.envAddress("TESTNET_USDT_ADDRESS");
        if (usdt != TARGET_USDT) revert WrongUsdt(usdt);
        if (usdt.code.length == 0) revert InvalidUsdt();
        if (IERC20Metadata(usdt).decimals() != 6) revert InvalidUsdt();
        if (keccak256(bytes(IERC20Metadata(usdt).symbol())) != keccak256(bytes("USDT"))) {
            revert InvalidUsdt();
        }

        address owner = vm.envAddress("GREN_OWNER_ADDRESS");
        address policyAdmin = vm.envAddress("GREN_POLICY_ADMIN_ADDRESS");
        address pauser = vm.envAddress("GREN_PAUSER_ADDRESS");
        address keeper = vm.envAddress("GREN_KEEPER_ADDRESS");
        if (
            owner == address(0) || policyAdmin == address(0) || pauser == address(0)
                || keeper == address(0) || owner == policyAdmin || owner == pauser
                || owner == keeper || policyAdmin == pauser || policyAdmin == keeper
                || pauser == keeper
        ) revert InvalidRoles();

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 policyAdminKey = vm.envUint("POLICY_ADMIN_PRIVATE_KEY");
        if (vm.addr(policyAdminKey) != policyAdmin) revert InvalidRoles();

        vm.startBroadcast(deployerKey);
        GrenVault conservative = new GrenVault(
            IERC20Metadata(usdt),
            "Gren Conservative Vault",
            "gUSDT-C",
            0,
            2_500,
            50,
            COOLDOWN_SECONDS,
            MAX_INPUT_AGE_SECONDS,
            owner,
            policyAdmin,
            pauser,
            keeper,
            false
        );
        GrenVault balanced = new GrenVault(
            IERC20Metadata(usdt),
            "Gren Balanced Vault",
            "gUSDT-B",
            1,
            4_500,
            80,
            COOLDOWN_SECONDS,
            MAX_INPUT_AGE_SECONDS,
            owner,
            policyAdmin,
            pauser,
            keeper,
            false
        );
        GrenVault aggressive = new GrenVault(
            IERC20Metadata(usdt),
            "Gren Aggressive Vault",
            "gUSDT-A",
            2,
            7_000,
            120,
            COOLDOWN_SECONDS,
            MAX_INPUT_AGE_SECONDS,
            owner,
            policyAdmin,
            pauser,
            keeper,
            false
        );
        ReserveStrategy conservativeReserve = new ReserveStrategy(address(conservative), usdt);
        ReserveStrategy balancedReserve = new ReserveStrategy(address(balanced), usdt);
        ReserveStrategy aggressiveReserve = new ReserveStrategy(address(aggressive), usdt);
        vm.stopBroadcast();

        vm.startBroadcast(policyAdminKey);
        conservative.setStrategyAllowed(address(conservativeReserve), true);
        balanced.setStrategyAllowed(address(balancedReserve), true);
        aggressive.setStrategyAllowed(address(aggressiveReserve), true);
        vm.stopBroadcast();

        _writePendingArtifact(
            usdt,
            owner,
            policyAdmin,
            pauser,
            keeper,
            conservative,
            balanced,
            aggressive,
            conservativeReserve,
            balancedReserve,
            aggressiveReserve
        );
    }

    function _writePendingArtifact(
        address usdt,
        address owner,
        address policyAdmin,
        address pauser,
        address keeper,
        GrenVault conservative,
        GrenVault balanced,
        GrenVault aggressive,
        ReserveStrategy conservativeReserve,
        ReserveStrategy balancedReserve,
        ReserveStrategy aggressiveReserve
    ) internal {
        string memory roles = vm.serializeAddress("roles", "owner", owner);
        roles = vm.serializeAddress("roles", "policyAdmin", policyAdmin);
        roles = vm.serializeAddress("roles", "pauser", pauser);
        roles = vm.serializeAddress("roles", "keeper", keeper);

        string memory vaults = vm.serializeAddress("vaults", "conservative", address(conservative));
        vaults = vm.serializeAddress("vaults", "balanced", address(balanced));
        vaults = vm.serializeAddress("vaults", "aggressive", address(aggressive));

        string memory strategies = vm.serializeAddress(
            "strategies", "conservativeReserve", address(conservativeReserve)
        );
        strategies = vm.serializeAddress("strategies", "balancedReserve", address(balancedReserve));
        strategies =
            vm.serializeAddress("strategies", "aggressiveReserve", address(aggressiveReserve));

        string memory usdtData = vm.serializeAddress("usdt", "address", usdt);
        usdtData = vm.serializeUint("usdt", "decimals", 6);
        usdtData = vm.serializeString("usdt", "symbol", "USDT");

        string memory policy = vm.serializeUint("policy", "cooldownSeconds", COOLDOWN_SECONDS);
        policy = vm.serializeUint("policy", "maxInputAgeSeconds", MAX_INPUT_AGE_SECONDS);
        policy = vm.serializeBool("policy", "bdexEnabled", false);

        string memory deployment = vm.serializeString("deployment", "network", "bot-chain-testnet");
        deployment = vm.serializeUint("deployment", "chainId", TARGET_CHAIN_ID);
        deployment = vm.serializeString("deployment", "rpcUrl", "https://rpc.bohr.life");
        deployment = vm.serializeString("deployment", "explorerUrl", "https://scan.bohr.life");
        deployment = vm.serializeString("deployment", "usdt", usdtData);
        deployment = vm.serializeString("deployment", "roles", roles);
        deployment = vm.serializeString("deployment", "vaults", vaults);
        deployment = vm.serializeString("deployment", "strategies", strategies);
        deployment = vm.serializeString("deployment", "policy", policy);
        deployment = vm.serializeUint("deployment", "deployedAt", block.timestamp);

        vm.writeJson(
            deployment,
            string.concat(vm.projectRoot(), "/script/deployments/bot-chain-testnet.pending.json")
        );
    }
}
