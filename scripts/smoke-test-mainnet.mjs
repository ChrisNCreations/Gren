#!/usr/bin/env node

/**
 * Mainnet smoke test — read-only verification of the on-chain deployment.
 * Does NOT send transactions or move funds. Safe to run at any time.
 *
 * Usage:
 *   node scripts/smoke-test-mainnet.mjs
 *   node scripts/smoke-test-mainnet.mjs /path/to/bot-chain-mainnet.json
 */

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = process.argv[2]
  ? isAbsolute(process.argv[2])
    ? process.argv[2]
    : resolve(repoRoot, process.argv[2])
  : resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-mainnet.json");

// Selectors verified via `forge inspect GrenVault abi`
const SELECTORS = {
  asset:             "0x38d52e0f",  // asset()
  totalAssets:       "0x01e1d114", // totalAssets()
  totalSupply:       "0x18160ddd", // totalSupply()
  profile:           "0xab60636c", // profile()
  bdexEnabled:       "0xf7d1c16c", // bdexEnabled()
  inventoryAdapter:  "0xea6a102a", // inventoryAdapter()
  maxDexBps:         "0xc5a05ee2", // maxDexBps()
  maxSlippageBps:    "0xc4aa7395", // maxSlippageBps()
  rebalanceCooldown: "0xb3de272d", // rebalanceCooldown()
  maxInputAge:       "0x7b2ff34e", // maxInputAge()
  currentReserveBps: "0x490879f9", // currentReserveBps()
  currentDexBps:     "0xdf166432", // currentDexBps()
  policyVersion:     "0x58355ead", // policyVersion()
  owner:             "0x8da5cb5b", // owner()
  decimals:          "0x313ce567", // decimals()
  symbol:            "0x95d89b41", // symbol()
  TOTAL_BPS:         "0xd3cd52bc", // TOTAL_BPS()
};

function rpcUrl(artifact) {
  return artifact.rpcUrl || "https://rpc.botchain.ai";
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
    const result = await ethCall(rpc, address, selector);
    return result;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n🔍 Mainnet Smoke Test`);
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

  // ── Artifact-level checks ──
  console.log("\n📄 Artifact checks");
  check("Network is bot-chain-mainnet", artifact.network === "bot-chain-mainnet");
  check("Chain ID is 677", artifact.chainId === 677);
  check("USDT symbol is USDT", artifact.usdt?.symbol === "USDT");
  check("USDT decimals is 6", artifact.usdt?.decimals === 6);
  check("BDEX is disabled", artifact.policy?.bdexEnabled === false);
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

  // ── Strategy count ──
  const vaultNames = Object.keys(artifact.vaults || {});
  const strategyNames = Object.keys(artifact.strategies || {});
  check(
    "Strategy count matches vault count",
    vaultNames.length === strategyNames.length && vaultNames.length === 3,
    `${vaultNames.length} vaults, ${strategyNames.length} strategies`,
  );

  // ── Transaction hashes ──
  const txCount = Object.keys(artifact.transactions || {}).length;
  check("Transaction hashes recorded", txCount >= 6, `${txCount} transactions`);

  // ── On-chain bytecode checks ──
  console.log("\n⛓️  On-chain bytecode");
  let rpcOk = true;
  for (const [name, addr] of Object.entries(artifact.vaults || {})) {
    try {
      const code = await ethCodeAt(rpc, addr);
      const hasCode = code && code !== "0x" && code !== "0x0";
      check(`${name} vault has bytecode`, hasCode, addr);
    } catch (error) {
      check(`${name} vault bytecode check`, false, `RPC error: ${error.message}`);
      rpcOk = false;
    }
  }

  for (const [name, addr] of Object.entries(artifact.strategies || {})) {
    try {
      const code = await ethCodeAt(rpc, addr);
      const hasCode = code && code !== "0x" && code !== "0x0";
      check(`${name} strategy has bytecode`, hasCode, addr);
    } catch (error) {
      check(`${name} strategy bytecode check`, false, `RPC error: ${error.message}`);
      rpcOk = false;
    }
  }

  // ── On-chain vault state ──
  if (rpcOk) {
    console.log("\n📊 On-chain vault state");
    for (const [name, addr] of Object.entries(artifact.vaults || {})) {
      try {
        const [profileHex, dexEnabledHex, adapterHex, totalAssetsHex, totalSupplyHex] =
          await Promise.all([
            readView(rpc, addr, SELECTORS.profile),
            readView(rpc, addr, SELECTORS.bdexEnabled),
            readView(rpc, addr, SELECTORS.inventoryAdapter),
            readView(rpc, addr, SELECTORS.totalAssets),
            readView(rpc, addr, SELECTORS.totalSupply),
          ]);

        const profile = decodeUint256(profileHex);
        const bdexEnabled = decodeUint256(dexEnabledHex) !== 0n;
        const adapter = decodeAddress(adapterHex);
        const totalAssets = decodeUint256(totalAssetsHex);
        const totalSupply = decodeUint256(totalSupplyHex);

        const expectedProfile = name === "conservative" ? 0n : name === "balanced" ? 1n : 2n;
        check(
          `${name} profile is ${expectedProfile}`,
          profile === expectedProfile,
          `got ${profile}`,
        );
        check(`${name} bdex is disabled`, !bdexEnabled);
        check(
          `${name} inventory adapter is zero`,
          adapter === "0x0000000000000000000000000000000000000000",
          adapter,
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
  }

  // ── Summary ──
  const passed = checks.every((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);
  console.log(`\n${"─".repeat(60)}`);
  if (passed) {
    console.log(`✅ All ${checks.length} checks passed — mainnet deployment verified.`);
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
  }

  console.log();
  process.exitCode = passed ? 0 : 1;
}

main().catch((error) => {
  console.error(`\n❌ Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
