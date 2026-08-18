import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  botChainTestnet,
  deploymentArtifactSchema,
  type DeploymentArtifact,
  type RiskProfile,
} from "@gren/shared";
import { getAddress, type Address, type Hex } from "viem";

export type AddressMap = Record<RiskProfile, Address>;
export type ModelProvider = "openai-compatible" | "gemini";

export type AgentConfig = {
  port: number;
  version: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  usdtAddress: Address;
  vaults: AddressMap;
  reserveStrategies: AddressMap;
  apiKey: string;
  keeperPrivateKey: Hex;
  decisionStorePath: string;
  modelProvider: ModelProvider;
  modelBaseUrl: string;
  modelApiKey: string | undefined;
  modelName: string;
  modelTimeoutMs: number;
};

const profiles = ["conservative", "balanced", "aggressive"] as const;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function resolveRepoPath(value: string): string {
  return isAbsolute(value) ? value : resolve(repoRoot, value);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function address(value: string, name: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${name} must be a valid EVM address`);
  }
}

function addressMap(
  env: NodeJS.ProcessEnv,
  artifact: DeploymentArtifact | undefined,
  suffix: "vaults" | "strategies",
): AddressMap {
  const names = {
    conservative: suffix === "vaults" ? "CONSERVATIVE_VAULT_ADDRESS" : "CONSERVATIVE_RESERVE_STRATEGY_ADDRESS",
    balanced: suffix === "vaults" ? "BALANCED_VAULT_ADDRESS" : "BALANCED_RESERVE_STRATEGY_ADDRESS",
    aggressive: suffix === "vaults" ? "AGGRESSIVE_VAULT_ADDRESS" : "AGGRESSIVE_RESERVE_STRATEGY_ADDRESS",
  } as const;

  return Object.fromEntries(
    profiles.map((profile) => {
      const configured = env[names[profile]];
      const fallback = suffix === "vaults"
        ? artifact?.vaults?.[profile]
        : artifact?.strategies?.[
            `${profile}Reserve` as "conservativeReserve" | "balancedReserve" | "aggressiveReserve"
          ];
      return [
        profile,
        address(configured?.trim() || fallback || "", `${names[profile]} or deployment artifact`),
      ];
    }),
  ) as AddressMap;
}

function loadArtifact(env: NodeJS.ProcessEnv): DeploymentArtifact | undefined {
  const configuredPath = env.GREN_DEPLOYMENT_ARTIFACT?.trim();
  const defaultPath = resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.json");
  const path = configuredPath ? resolveRepoPath(configuredPath) : defaultPath;

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return deploymentArtifactSchema.parse(parsed);
  } catch (error) {
    if (!configuredPath && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Unable to load deployment artifact ${path}: ${String(error)}`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const artifact = loadArtifact(env);
  const chainId = Number(env.BOT_CHAIN_ID ?? artifact?.chainId ?? botChainTestnet.id);
  const rpcUrl = env.BOT_CHAIN_RPC_URL?.trim() || artifact?.rpcUrl || botChainTestnet.rpcUrl;
  const explorerUrl = env.BOT_CHAIN_EXPLORER_URL?.trim() || artifact?.explorerUrl || botChainTestnet.explorerUrl;
  const usdtAddress = address(
    env.TESTNET_USDT_ADDRESS?.trim() || artifact?.usdt.address || botChainTestnet.contracts.usdt,
    "TESTNET_USDT_ADDRESS",
  );

  if (chainId !== botChainTestnet.id) {
    throw new Error(`Only BOT Chain Testnet (${botChainTestnet.id}) is supported; received ${chainId}`);
  }
  if (rpcUrl.includes("rpc.botchain.ai") || explorerUrl.includes("scan.botchain.ai")) {
    throw new Error("Mainnet RPC and explorer URLs are not allowed in the testnet agent");
  }
  if (usdtAddress.toLowerCase() !== botChainTestnet.contracts.usdt.toLowerCase()) {
    throw new Error("TESTNET_USDT_ADDRESS does not match the verified BOT Chain testnet USDT");
  }

  const keeperPrivateKeyValue = required(env, "KEEPER_PRIVATE_KEY");
  const keeperPrivateKey = /^[a-fA-F0-9]{64}$/.test(keeperPrivateKeyValue)
    ? `0x${keeperPrivateKeyValue}`
    : keeperPrivateKeyValue;
  if (!/^0x[a-fA-F0-9]{64}$/.test(keeperPrivateKey)) {
    throw new Error("KEEPER_PRIVATE_KEY must be a 32-byte hex private key");
  }

  const modelProviderValue = (env.MODEL_PROVIDER?.trim().toLowerCase() || "openai-compatible") as ModelProvider;
  if (modelProviderValue !== "openai-compatible" && modelProviderValue !== "gemini") {
    throw new Error("MODEL_PROVIDER must be openai-compatible or gemini");
  }

  const modelTimeoutMs = Number(env.MODEL_TIMEOUT_MS ?? 8_000);
  if (!Number.isInteger(modelTimeoutMs) || modelTimeoutMs <= 0) {
    throw new Error("MODEL_TIMEOUT_MS must be a positive integer");
  }

  return {
    port: Number(env.PORT ?? 8787),
    version: env.GREN_AGENT_VERSION?.trim() || "0.1.0",
    rpcUrl,
    chainId,
    explorerUrl,
    usdtAddress,
    vaults: addressMap(env, artifact, "vaults"),
    reserveStrategies: addressMap(env, artifact, "strategies"),
    apiKey: required(env, "AGENT_API_KEY"),
    keeperPrivateKey: keeperPrivateKey as Hex,
    decisionStorePath: resolveRepoPath(env.DECISION_STORE_PATH?.trim() || ".agent/decisions.json"),
    modelProvider: modelProviderValue,
    modelBaseUrl: env.MODEL_BASE_URL?.trim()
      || (modelProviderValue === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "https://api.groq.com/openai/v1"),
    modelApiKey: modelProviderValue === "gemini"
      ? firstPresent(env, ["GEMINI_API_KEY", "MODEL_API_KEY"])
      : firstPresent(env, ["MODEL_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "XAI_API_KEY"]),
    modelName: env.MODEL_NAME?.trim()
      || (modelProviderValue === "gemini" ? "gemini-2.0-flash" : "openai/gpt-oss-20b"),
    modelTimeoutMs,
  };
}

function firstPresent(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}
