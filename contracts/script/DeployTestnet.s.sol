// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IBdexPair, IBdexRouter } from "../src/interfaces/IBdexRouter.sol";
import { GrenVault } from "../src/core/GrenVault.sol";
import { BdexStrategy } from "../src/strategies/BdexStrategy.sol";
import { ReserveStrategy } from "../src/strategies/ReserveStrategy.sol";

interface IUniV2RouterView {
    function factory() external view returns (address);

    function WETH() external view returns (address);
}

contract DeployTestnet is Script {
    uint256 internal constant TARGET_CHAIN_ID = 968;
    address internal constant TARGET_USDT = 0x75edC9335175Fc0552D51D48439F229c10420fe3;
    address internal constant TARGET_WBOT = 0xD5452816194a3784dBa983426cCe7c122F4abd30;
    address internal constant TARGET_BDEX_ROUTER = 0xD6425a02f0845B8D99e349C34D2E7A576E177345;
    address internal constant TARGET_BDEX_FACTORY = 0x65b8e98ceA190d8c28B3e4716402027f634d15a3;
    address internal constant TARGET_BDEX_PAIR = 0xD3EC267707BA234583645E75CE283Cf679dd94Fa;
    uint64 internal constant COOLDOWN_SECONDS = 1 hours;
    uint64 internal constant MAX_INPUT_AGE_SECONDS = 15 minutes;
    uint256 internal constant MIN_USDT_RESERVE = 1_000 * 1e6;

    error WrongNetwork(uint256 actualChainId);
    error WrongUsdt(address actual);
    error InvalidUsdt();
    error InvalidRoles();
    error InvalidBdexRoute();
    error InsufficientBdexLiquidity();

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

        _verifyBdexRoute(usdt);

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
            true
        );
        ReserveStrategy conservativeReserve = new ReserveStrategy(address(conservative), usdt);
        ReserveStrategy balancedReserve = new ReserveStrategy(address(balanced), usdt);
        ReserveStrategy aggressiveReserve = new ReserveStrategy(address(aggressive), usdt);
        BdexStrategy aggressiveBdex = new BdexStrategy(
            address(aggressive), usdt, TARGET_WBOT, TARGET_BDEX_ROUTER, TARGET_BDEX_PAIR
        );
        vm.stopBroadcast();

        vm.startBroadcast(policyAdminKey);
        conservative.setStrategyAllowed(address(conservativeReserve), true);
        balanced.setStrategyAllowed(address(balancedReserve), true);
        aggressive.setStrategyAllowed(address(aggressiveReserve), true);
        aggressive.setStrategyAllowed(address(aggressiveBdex), true);
        aggressive.setInventoryAdapter(address(aggressiveBdex));
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
            aggressiveReserve,
            aggressiveBdex
        );
    }

    function _verifyBdexRoute(address usdt) internal view {
        if (
            TARGET_WBOT.code.length == 0 || TARGET_BDEX_ROUTER.code.length == 0
                || TARGET_BDEX_FACTORY.code.length == 0 || TARGET_BDEX_PAIR.code.length == 0
        ) revert InvalidBdexRoute();
        if (IERC20Metadata(TARGET_WBOT).decimals() != 18) revert InvalidBdexRoute();

        IUniV2RouterView routerView = IUniV2RouterView(TARGET_BDEX_ROUTER);
        if (routerView.factory() != TARGET_BDEX_FACTORY || routerView.WETH() != TARGET_WBOT) {
            revert InvalidBdexRoute();
        }

        IBdexPair pair = IBdexPair(TARGET_BDEX_PAIR);
        address token0 = pair.token0();
        address token1 = pair.token1();
        bool usdtWbotPair =
            (token0 == usdt && token1 == TARGET_WBOT) || (token1 == usdt && token0 == TARGET_WBOT);
        if (!usdtWbotPair) revert InvalidBdexRoute();

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 usdtReserve = token0 == usdt ? uint256(reserve0) : uint256(reserve1);
        uint256 wbotReserve = token0 == TARGET_WBOT ? uint256(reserve0) : uint256(reserve1);
        if (usdtReserve < MIN_USDT_RESERVE || wbotReserve == 0) revert InsufficientBdexLiquidity();

        address[] memory path = new address[](2);
        path[0] = usdt;
        path[1] = TARGET_WBOT;
        uint256[] memory quoted = IBdexRouter(TARGET_BDEX_ROUTER).getAmountsOut(1e6, path);
        if (quoted.length != 2 || quoted[1] == 0) revert InsufficientBdexLiquidity();
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
        ReserveStrategy aggressiveReserve,
        BdexStrategy aggressiveBdex
    ) internal {
        string memory roles = vm.serializeAddress("roles", "owner", owner);
        roles = vm.serializeAddress("roles", "policyAdmin", policyAdmin);
        roles = vm.serializeAddress("roles", "pauser", pauser);
        roles = vm.serializeAddress("roles", "keeper", keeper);

        string memory vaults = vm.serializeAddress("vaults", "conservative", address(conservative));
        vaults = vm.serializeAddress("vaults", "balanced", address(balanced));
        vaults = vm.serializeAddress("vaults", "aggressive", address(aggressive));

        string memory strategies =
            vm.serializeAddress("strategies", "conservativeReserve", address(conservativeReserve));
        strategies = vm.serializeAddress("strategies", "balancedReserve", address(balancedReserve));
        strategies =
            vm.serializeAddress("strategies", "aggressiveReserve", address(aggressiveReserve));
        strategies = vm.serializeAddress("strategies", "aggressiveBdex", address(aggressiveBdex));

        string memory usdtData = vm.serializeAddress("usdt", "address", usdt);
        usdtData = vm.serializeUint("usdt", "decimals", 6);
        usdtData = vm.serializeString("usdt", "symbol", "USDT");

        string memory policy = vm.serializeUint("policy", "cooldownSeconds", COOLDOWN_SECONDS);
        policy = vm.serializeUint("policy", "maxInputAgeSeconds", MAX_INPUT_AGE_SECONDS);
        policy = vm.serializeBool("policy", "bdexEnabled", true);

        string memory vaultBdex = vm.serializeBool("vaultBdex", "conservative", false);
        vaultBdex = vm.serializeBool("vaultBdex", "balanced", false);
        vaultBdex = vm.serializeBool("vaultBdex", "aggressive", true);

        string memory bdex = vm.serializeAddress("bdex", "wbot", TARGET_WBOT);
        bdex = vm.serializeAddress("bdex", "router", TARGET_BDEX_ROUTER);
        bdex = vm.serializeAddress("bdex", "factory", TARGET_BDEX_FACTORY);
        bdex = vm.serializeAddress("bdex", "pair", TARGET_BDEX_PAIR);
        bdex = vm.serializeAddress("bdex", "aggressiveStrategy", address(aggressiveBdex));
        bdex = vm.serializeString("bdex", "oracle", "pair-reserves");

        string memory deployment = vm.serializeString("deployment", "network", "bot-chain-testnet");
        deployment = vm.serializeUint("deployment", "chainId", TARGET_CHAIN_ID);
        deployment = vm.serializeString("deployment", "rpcUrl", "https://rpc.bohr.life");
        deployment = vm.serializeString("deployment", "explorerUrl", "https://scan.bohr.life");
        deployment = vm.serializeString("deployment", "usdt", usdtData);
        deployment = vm.serializeString("deployment", "roles", roles);
        deployment = vm.serializeString("deployment", "vaults", vaults);
        deployment = vm.serializeString("deployment", "strategies", strategies);
        deployment = vm.serializeString("deployment", "policy", policy);
        deployment = vm.serializeString("deployment", "vaultBdex", vaultBdex);
        deployment = vm.serializeString("deployment", "bdex", bdex);
        deployment = vm.serializeUint("deployment", "deployedAt", block.timestamp);

        vm.writeJson(
            deployment,
            string.concat(vm.projectRoot(), "/script/deployments/bot-chain-testnet.pending.json")
        );
    }
}
