import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webEnvPath = resolve(repoRoot, "apps", "web", ".env.local");
const agentEnvPath = resolve(repoRoot, ".env.local");
const configuredArtifact = process.env.GREN_DEPLOYMENT_ARTIFACT?.trim();
const artifactPath = configuredArtifact
  ? (isAbsolute(configuredArtifact) ? configuredArtifact : resolve(repoRoot, configuredArtifact))
  : resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.json");
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return "";
  }
}

function syncValues(contents, values) {
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    const line = `${name}=${value}`;
    contents = pattern.test(contents)
      ? contents.replace(pattern, line)
      : `${contents.replace(/\s*$/, "")}\n${line}\n`;
  }
  return contents;
}

let webContents = await readOptional(webEnvPath);
const existingAgentUrl = webContents.match(/^NEXT_PUBLIC_AGENT_URL=(.*)$/m)?.[1]?.trim();
const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL?.trim()
  || existingAgentUrl
  || "http://localhost:8787";

if (process.env.NODE_ENV === "production" && !agentUrl.startsWith("https://")) {
  throw new Error("NEXT_PUBLIC_AGENT_URL must use HTTPS in production");
}

const webValues = {
  NEXT_PUBLIC_BOT_CHAIN_RPC_URL: artifact.rpcUrl,
  NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL: artifact.explorerUrl,
  NEXT_PUBLIC_BOT_CHAIN_ID: String(artifact.chainId),
  NEXT_PUBLIC_USDT_ADDRESS: artifact.usdt.address,
  NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS: artifact.vaults.conservative,
  NEXT_PUBLIC_BALANCED_VAULT_ADDRESS: artifact.vaults.balanced,
  NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS: artifact.vaults.aggressive,
  NEXT_PUBLIC_AGENT_URL: agentUrl,
};

const agentValues = {
  BOT_CHAIN_RPC_URL: artifact.rpcUrl,
  BOT_CHAIN_EXPLORER_URL: artifact.explorerUrl,
  BOT_CHAIN_ID: String(artifact.chainId),
  TESTNET_USDT_ADDRESS: artifact.usdt.address,
  GREN_DEPLOYMENT_ARTIFACT: "contracts/script/deployments/bot-chain-testnet.json",
  GREN_OWNER_ADDRESS: artifact.roles.owner,
  GREN_POLICY_ADMIN_ADDRESS: artifact.roles.policyAdmin,
  GREN_PAUSER_ADDRESS: artifact.roles.pauser,
  GREN_KEEPER_ADDRESS: artifact.roles.keeper,
  CONSERVATIVE_VAULT_ADDRESS: artifact.vaults.conservative,
  BALANCED_VAULT_ADDRESS: artifact.vaults.balanced,
  AGGRESSIVE_VAULT_ADDRESS: artifact.vaults.aggressive,
  CONSERVATIVE_RESERVE_STRATEGY_ADDRESS: artifact.strategies.conservativeReserve,
  BALANCED_RESERVE_STRATEGY_ADDRESS: artifact.strategies.balancedReserve,
  AGGRESSIVE_RESERVE_STRATEGY_ADDRESS: artifact.strategies.aggressiveReserve,
  ...(artifact.strategies.aggressiveBdex
    ? { AGGRESSIVE_BDEX_STRATEGY_ADDRESS: artifact.strategies.aggressiveBdex }
    : {}),
};

webContents = syncValues(webContents, webValues);
await writeFile(webEnvPath, webContents, "utf8");

let agentContents = await readOptional(agentEnvPath);
agentContents = syncValues(agentContents, agentValues);
await writeFile(agentEnvPath, agentContents, "utf8");

console.log(`Public deployment configuration synchronized to ${webEnvPath}`);
console.log(`Non-secret agent deployment configuration synchronized to ${agentEnvPath}`);
