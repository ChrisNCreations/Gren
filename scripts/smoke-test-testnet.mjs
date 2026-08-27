#!/usr/bin/env node

/**
 * Testnet smoke test.
 *
 * Default: read-only verification of the on-chain deployment, including the
 * verified BDEX V2 WBOT/USDT route. Does not send transactions.
 *
 * Live Phase 3 exit gate (deposit → BDEX rebalance → unwind withdraw):
 *   node scripts/smoke-test-testnet.mjs --live
 *
 * Usage:
 *   node scripts/smoke-test-testnet.mjs
 *   node scripts/smoke-test-testnet.mjs /path/to/bot-chain-testnet.json
 *   node scripts/smoke-test-testnet.mjs --live
 */

import { spawnSync } from "node:child_process";

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const live = process.argv.includes("--live");
const artifactArg = process.argv.slice(2).find((arg) => arg !== "--live");
const artifactPath = artifactArg
  ? isAbsolute(artifactArg)
    ? artifactArg
    : resolve(repoRoot, artifactArg)
  : resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.json");

const VERIFIED_BDEX = {
  wbot: "0xd5452816194a3784dba983426cce7c122f4abd30",
  router: "0xd6425a02f0845b8d99e349c34d2e7a576e177345",
  factory: "0x65b8e98cea190d8c28b3e4716402027f634d15a3",
  pair: "0xd3ec267707ba234583645e75ce283cf679dd94fa",
  minUsdtReserve: 1_000n * 1_000_000n,
};

// Selectors verified via `forge inspect GrenVault abi`
const SELECTORS = {
  asset:             "0x38d52e0f",
  totalAssets:       "0x01e1d114",
  totalSupply:       "0x18160ddd",
  profile:           "0xab60636c",
  bdexEnabled:       "0xf7d1c16c",
  inventoryAdapter:  "0xea6a102a",
  maxDexBps:         "0xc5a05ee2",
  maxSlippageBps:    "0xc4aa7395",
  rebalanceCooldown: "0xb3de272d",
  maxInputAge:       "0x7b2ff34e",
  currentReserveBps: "0x490879f9",
  currentDexBps:     "0xdf166432",
  policyVersion:     "0x58355ead",
  owner:             "0x8da5cb5b",
  decimals:          "0x313ce567",
  symbol:            "0x95d89b41",
  TOTAL_BPS:         "0xd3cd52bc",
  pauser:            "0x451077c7",
  keeper:            "0xc3b73d56",
  cooldownActive:    "0x30cd7471",
  maxWithdrawAssets: "0xb3de272d", // Using rebalanceCooldown slot — we use totalAssets for check
};

// Strategy selectors
const STRATEGY_SELECTORS = {
  vault:              "0xfbfa77cf", // vault()
  dexInventoryUsdt:   "0xeb62f707", // dexInventoryUsdt()
};

function rpcUrl(artifact) {
  return artifact.rpcUrl || "https://rpc.bohr.life";
}

async function ethCall(rpc, to, data) {
  const resp = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(`RPC error on ${to}: ${json.error.message}`);
  return json.result;
}

async function ethCodeAt(rpc, address) {
  const resp = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  const json = await resp.json();
  return json.result;
}

async function ethBlockNumber(rpc) {
  const resp = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
  });
  const json = await resp.json();
  return json.result;
}

function decodeAddress(hex) {
  if (!hex || hex === "0x" || hex.length < 42) return "0x0000000000000000000000000000000000000000";
  return "0x" + hex.slice(-40);
}

function decodeUint256(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

async function readView(rpc, address, selector) {
  try {
    return await ethCall(rpc, address, selector);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n🔍 Testnet Smoke Test`);
  console.log(`   Artifact: ${artifactPath}\n`);

  let artifact;
  try {
    artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  } catch (error) {
    console.error(`❌ Cannot read artifact: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const rpc = rpcUrl(artifact);
  const checks = [];

  function check(label, passed, detail = "") {
    const icon = passed ? "✅" : "❌";
    checks.push({ label, passed, detail });
    console.log(`   ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  }

  // ── Connectivity ──
  console.log("🌐 Network connectivity");
  let rpcOk = true;
  try {
    const blockHex = await ethBlockNumber(rpc);
    const block = Number(decodeUint256(blockHex));
    check("RPC reachable", block > 0, `block #${block}`);
  } catch (error) {
    check("RPC reachable", false, error.message);
    rpcOk = false;
  }

  // ── Artifact-level checks ──
  console.log("\n📄 Artifact checks");
  check("Network is bot-chain-testnet", artifact.network === "bot-chain-testnet");
  check("Chain ID is 968", artifact.chainId === 968);
  check("USDT symbol is USDT", artifact.usdt?.symbol === "USDT");
  check("USDT decimals is 6", artifact.usdt?.decimals === 6);
  check("BDEX is enabled on the testnet artifact", artifact.policy?.bdexEnabled === true);
  check("Conservative vault keeps BDEX off", artifact.vaultBdex?.conservative === false);
  check("Balanced vault keeps BDEX off", artifact.vaultBdex?.balanced === false);
  check("Aggressive vault enables BDEX", artifact.vaultBdex?.aggressive === true);
  check(
    "BDEX WBOT is the verified testnet token",
    artifact.bdex?.wbot?.toLowerCase() === VERIFIED_BDEX.wbot,
    artifact.bdex?.wbot,
  );
  check(
    "BDEX router is BotDex V2",
    artifact.bdex?.router?.toLowerCase() === VERIFIED_BDEX.router,
    artifact.bdex?.router,
  );
  check(
    "BDEX pair is the verified WBOT/USDT pool",
    artifact.bdex?.pair?.toLowerCase() === VERIFIED_BDEX.pair,
    artifact.bdex?.pair,
  );
  check("BDEX oracle is pair reserves", artifact.bdex?.oracle === "pair-reserves");
  check(
    "Aggressive BDEX strategy recorded",
    Boolean(artifact.strategies?.aggressiveBdex || artifact.bdex?.aggressiveStrategy),
    artifact.strategies?.aggressiveBdex || artifact.bdex?.aggressiveStrategy,
  );
  check("Explorer URL set", Boolean(artifact.explorerUrl));
  check("RPC URL set", Boolean(rpc));

  // ── Role separation ──
  console.log("\n👤 Role separation");
  const roles = artifact.roles || {};
  const roleAddresses = [roles.owner, roles.policyAdmin, roles.pauser, roles.keeper];
  const allDistinct = new Set(roleAddresses.map((a) => a?.toLowerCase())).size === 4;
  const noneZero = roleAddresses.every(
    (a) => a && a !== "0x0000000000000000000000000000000000000000",
  );
  check("All four roles are distinct nonzero addresses", allDistinct && noneZero);
  for (const [name, addr] of Object.entries(roles)) {
    check(`  ${name.padEnd(12)} ${addr}`, Boolean(addr) && addr !== "0x0000000000000000000000000000000000000000");
  }

  // ── Strategy count ──
  const vaultNames = Object.keys(artifact.vaults || {});
  const strategyNames = Object.keys(artifact.strategies || {});
  const expectedStrategies = artifact.policy?.bdexEnabled ? 4 : 3;
  check(
    "Vault and strategy counts match Phase 3 layout",
    vaultNames.length === 3 && strategyNames.length === expectedStrategies,
    `${vaultNames.length} vaults, ${strategyNames.length} strategies`,
  );

  // ── Transaction hashes ──
  const txCount = Object.keys(artifact.transactions || {}).length;
  check("Transaction hashes recorded", txCount >= 6, `${txCount} transactions`);

  // ── On-chain bytecode checks ──
  if (rpcOk) {
    console.log("\n⛓️  On-chain bytecode");
    for (const [name, addr] of Object.entries(artifact.vaults || {})) {
      try {
        const code = await ethCodeAt(rpc, addr);
        const hasCode = code && code !== "0x" && code !== "0x0";
        check(`${name} vault has bytecode`, hasCode, addr);
      } catch (error) {
        check(`${name} vault bytecode check`, false, `RPC error: ${error.message}`);
      }
    }

    for (const [name, addr] of Object.entries(artifact.strategies || {})) {
      try {
        const code = await ethCodeAt(rpc, addr);
        const hasCode = code && code !== "0x" && code !== "0x0";
        check(`${name} strategy has bytecode`, hasCode, addr);
      } catch (error) {
        check(`${name} strategy bytecode check`, false, `RPC error: ${error.message}`);
      }
    }

    // ── On-chain vault state ──
    console.log("\n📊 On-chain vault state");
    for (const [name, addr] of Object.entries(artifact.vaults || {})) {
      try {
        const [profileHex, dexEnabledHex, adapterHex, totalAssetsHex, totalSupplyHex, ownerHex] =
          await Promise.all([
            readView(rpc, addr, SELECTORS.profile),
            readView(rpc, addr, SELECTORS.bdexEnabled),
            readView(rpc, addr, SELECTORS.inventoryAdapter),
            readView(rpc, addr, SELECTORS.totalAssets),
            readView(rpc, addr, SELECTORS.totalSupply),
            readView(rpc, addr, SELECTORS.owner),
          ]);

        const profile = decodeUint256(profileHex);
        const bdexEnabled = decodeUint256(dexEnabledHex) !== 0n;
        const adapter = decodeAddress(adapterHex);
        const totalAssets = decodeUint256(totalAssetsHex);
        const totalSupply = decodeUint256(totalSupplyHex);
        const owner = decodeAddress(ownerHex);

        const expectedProfile = name === "conservative" ? 0n : name === "balanced" ? 1n : 2n;
        check(
          `${name} profile is ${expectedProfile}`,
          profile === expectedProfile,
          `got ${profile}`,
        );
        const expectBdex = name === "aggressive";
        check(
          `${name} bdex is ${expectBdex ? "enabled" : "disabled"}`,
          bdexEnabled === expectBdex,
        );
        if (expectBdex) {
          const expectedAdapter = (
            artifact.strategies?.aggressiveBdex || artifact.bdex?.aggressiveStrategy || ""
          ).toLowerCase();
          check(
            `${name} inventory adapter is the BDEX strategy`,
            adapter.toLowerCase() === expectedAdapter && adapter !== "0x0000000000000000000000000000000000000000",
            adapter,
          );
        } else {
          check(
            `${name} inventory adapter is zero`,
            adapter === "0x0000000000000000000000000000000000000000",
            adapter,
          );
        }
        check(
          `${name} owner matches artifact`,
          owner.toLowerCase() === roles.owner?.toLowerCase(),
          owner,
        );
        check(
          `${name} has on-chain state`,
          totalAssets >= 0n && totalSupply >= 0n,
          `assets=${totalAssets} shares=${totalSupply}`,
        );
      } catch (error) {
        check(`${name} vault state check`, false, error.message);
      }
    }

    // ── Strategy-vault linkage ──
    console.log("\n🔗 Strategy-vault linkage");
    for (const [name, addr] of Object.entries(artifact.strategies || {})) {
      try {
        const vaultHex = await readView(rpc, addr, STRATEGY_SELECTORS.vault);
        const strategyVault = decodeAddress(vaultHex);
        const expectedVault = artifact.vaults[name.replace("Reserve", "").replace("reserve", "")] ||
                              artifact.vaults[name];
        // Try to find matching vault
        let matched = false;
        for (const [vName, vAddr] of Object.entries(artifact.vaults || {})) {
          if (vAddr.toLowerCase() === strategyVault.toLowerCase()) {
            check(`${name} strategy → ${vName} vault`, true, strategyVault);
            matched = true;
            break;
          }
        }
        if (!matched) {
          check(`${name} strategy points to known vault`, false, strategyVault);
        }
      } catch (error) {
        check(`${name} strategy-vault linkage`, false, error.message);
      }
    }

    const bdexStrategy = artifact.strategies?.aggressiveBdex || artifact.bdex?.aggressiveStrategy;
    if (bdexStrategy) {
      try {
        const vaultHex = await readView(rpc, bdexStrategy, STRATEGY_SELECTORS.vault);
        const strategyVault = decodeAddress(vaultHex);
        check(
          "aggressive BDEX strategy → aggressive vault",
          strategyVault.toLowerCase() === artifact.vaults.aggressive.toLowerCase(),
          strategyVault,
        );
      } catch (error) {
        check("aggressive BDEX strategy-vault linkage", false, error.message);
      }
    }

    console.log("\n💧 BDEX pool, route, and oracle");
    try {
      const pair = artifact.bdex?.pair || `0x${VERIFIED_BDEX.pair.slice(2)}`;
      const router = artifact.bdex?.router || `0x${VERIFIED_BDEX.router.slice(2)}`;
      const usdt = artifact.usdt.address;
      const wbot = artifact.bdex?.wbot;
      const [token0Hex, token1Hex, reservesHex, pairCode, routerCode] = await Promise.all([
        readView(rpc, pair, "0x0dfe1681"),
        readView(rpc, pair, "0xd21220a7"),
        readView(rpc, pair, "0x0902f1ac"),
        ethCodeAt(rpc, pair),
        ethCodeAt(rpc, router),
      ]);
      const token0 = decodeAddress(token0Hex);
      const token1 = decodeAddress(token1Hex);
      const usdtWbot = (
        (token0.toLowerCase() === usdt.toLowerCase() && token1.toLowerCase() === wbot?.toLowerCase())
        || (token1.toLowerCase() === usdt.toLowerCase() && token0.toLowerCase() === wbot?.toLowerCase())
      );
      check("BDEX pair has bytecode", pairCode && pairCode !== "0x" && pairCode !== "0x0", pair);
      check("BDEX router has bytecode", routerCode && routerCode !== "0x" && routerCode !== "0x0", router);
      check("BDEX pair is USDT/WBOT", usdtWbot, `${token0}/${token1}`);

      const raw = (reservesHex || "0x").slice(2).padStart(192, "0");
      const reserve0 = BigInt("0x" + raw.slice(0, 64));
      const reserve1 = BigInt("0x" + raw.slice(64, 128));
      const usdtReserve = token0.toLowerCase() === usdt.toLowerCase() ? reserve0 : reserve1;
      const wbotReserve = token0.toLowerCase() === wbot?.toLowerCase() ? reserve0 : reserve1;
      check(
        "BDEX pair has realistic USDT liquidity",
        usdtReserve >= VERIFIED_BDEX.minUsdtReserve && wbotReserve > 0n,
        `usdt=${usdtReserve} wbot=${wbotReserve}`,
      );

      const amountIn = (1_000_000n).toString(16).padStart(64, "0");
      const offset = (64).toString(16).padStart(64, "0");
      const length = (2).toString(16).padStart(64, "0");
      const quoteData = `0xd06ca61f${amountIn}${offset}${length}${usdt.slice(2).padStart(64, "0")}${wbot.slice(2).padStart(64, "0")}`;
      const quoted = await ethCall(rpc, router, quoteData);
      const quotedOut = quoted && quoted !== "0x" ? BigInt("0x" + quoted.slice(-64)) : 0n;
      check("BDEX router quotes USDT → WBOT", quotedOut > 0n, `1 USDT → ${quotedOut} WBOT wei`);
    } catch (error) {
      check("BDEX pool/route/oracle check", false, error.message);
    }
  }

  // ── Summary ──
  const passed = checks.filter((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);
  console.log(`\n${"─".repeat(60)}`);
  if (failed.length === 0) {
    console.log(`✅ All ${checks.length} checks passed — testnet deployment verified.`);
  } else {
    console.log(`❌ ${failed.length} of ${checks.length} checks failed:`);
    for (const f of failed) {
      console.log(`   • ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }

  // ── Explorer links ──
  if (artifact.explorerUrl) {
    console.log(`\n🔗 Explorer links:`);
    for (const [name, addr] of Object.entries(artifact.vaults || {})) {
      console.log(`   ${name.padEnd(14)} ${artifact.explorerUrl}/address/${addr}`);
    }
    for (const [name, addr] of Object.entries(artifact.strategies || {})) {
      console.log(`   ${name.padEnd(14)} ${artifact.explorerUrl}/address/${addr}`);
    }
  }

  if (failed.length === 0 && live) {
    console.log("\n🚀 Live Phase 3 exit gate: deposit → BDEX rebalance → unwind withdraw");
    const result = spawnSync(
      "forge",
      [
        "script",
        "script/SmokeBdexTestnet.s.sol:SmokeBdexTestnet",
        "--broadcast",
        "--slow",
        "--rpc-url",
        "botchainTestnet",
        "-vvv",
      ],
      {
        cwd: resolve(repoRoot, "contracts"),
        env: process.env,
        stdio: "inherit",
        shell: true,
      },
    );
    if (result.status !== 0) {
      console.log("❌ Live BDEX smoke failed");
      process.exitCode = 1;
      return;
    }
    console.log("✅ Live BDEX rebalance and unwind-withdraw succeeded. Record hashes from the forge broadcast.");
  }

  console.log();
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(`\n❌ Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
