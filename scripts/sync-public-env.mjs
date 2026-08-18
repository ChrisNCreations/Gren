import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(repoRoot, ".env.local");
const artifactPath = resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.json");
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const values = {
  NEXT_PUBLIC_BOT_CHAIN_RPC_URL: artifact.rpcUrl,
  NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL: artifact.explorerUrl,
  NEXT_PUBLIC_BOT_CHAIN_ID: String(artifact.chainId),
  NEXT_PUBLIC_USDT_ADDRESS: artifact.usdt.address,
  NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS: artifact.vaults.conservative,
  NEXT_PUBLIC_BALANCED_VAULT_ADDRESS: artifact.vaults.balanced,
  NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS: artifact.vaults.aggressive,
  NEXT_PUBLIC_AGENT_URL: "http://localhost:8787",
  BOT_CHAIN_RPC_URL: artifact.rpcUrl,
  BOT_CHAIN_EXPLORER_URL: artifact.explorerUrl,
  BOT_CHAIN_ID: String(artifact.chainId),
  TESTNET_USDT_ADDRESS: artifact.usdt.address,
  GREN_DEPLOYMENT_ARTIFACT: "contracts/script/deployments/bot-chain-testnet.json",
  GREN_OWNER_ADDRESS: artifact.roles.owner,
  GREN_POLICY_ADMIN_ADDRESS: artifact.roles.policyAdmin,
  GREN_PAUSER_ADDRESS: artifact.roles.pauser,
  GREN_KEEPER_ADDRESS: artifact.roles.keeper,
  CONSERVATIVE_RESERVE_STRATEGY_ADDRESS: artifact.strategies.conservativeReserve,
  BALANCED_RESERVE_STRATEGY_ADDRESS: artifact.strategies.balancedReserve,
  AGGRESSIVE_RESERVE_STRATEGY_ADDRESS: artifact.strategies.aggressiveReserve,
  BOT_CHAIN_TESTNET_RPC_URL: artifact.rpcUrl,
};

let contents = await readFile(envPath, "utf8");
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const line = `${name}=${value}`;
  contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.replace(/\s*$/, "")}\n${line}\n`;
}
await writeFile(envPath, contents, "utf8");
console.log("Public deployment configuration synchronized to .env.local");
