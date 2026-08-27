import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  botChainById,
  botChainMainnet,
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
  bdexStrategies: Partial<AddressMap>;
  apiKey: string;
  keeperPrivateKey: Hex;
  decisionStorePath: string;
  decisionStoreBackend: "file" | "supabase";
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  maxDecisionRecords: number;
  decisionRetentionMs: number;
  allowedOrigins: string[];
  maxRequestBodyBytes: number;
  rateLimitWindowMs: number;
  previewRateLimit: number;
  statusRateLimit: number;
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

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
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

function loadBdexStrategies(
  env: NodeJS.ProcessEnv,
  artifact: DeploymentArtifact | undefined,
): Partial<AddressMap> {
  const configured = env.AGGRESSIVE_BDEX_STRATEGY_ADDRESS?.trim()
    || artifact?.strategies?.aggressiveBdex
    || artifact?.bdex?.aggressiveStrategy;
  if (!configured) return {};
  return { aggressive: address(configured, "AGGRESSIVE_BDEX_STRATEGY_ADDRESS") };
}

function defaultArtifactPath(chainId: number | undefined): string {
  const fileName = chainId === botChainMainnet.id ? "bot-chain-mainnet.json" : "bot-chain-testnet.json";
  return resolve(repoRoot, "contracts", "script", "deployments", fileName);
}

function loadArtifact(env: NodeJS.ProcessEnv, requestedChainId: number | undefined): DeploymentArtifact | undefined {
  const configuredPath = env.GREN_DEPLOYMENT_ARTIFACT?.trim();
  const path = configuredPath ? resolveRepoPath(configuredPath) : defaultArtifactPath(requestedChainId);

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const artifact = deploymentArtifactSchema.parse(parsed);
    if (requestedChainId && artifact.chainId !== requestedChainId) {
      throw new Error(`Deployment artifact chain ${artifact.chainId} does not match BOT_CHAIN_ID ${requestedChainId}`);
    }
    return artifact;
  } catch (error) {
    if (!configuredPath && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Unable to load deployment artifact ${path}: ${String(error)}`);
  }
}

function assertNetworkPairing(
  network: NonNullable<ReturnType<typeof botChainById>>,
  rpcUrl: string,
  explorerUrl: string,
  usdtAddress: Address,
): void {
  if (usdtAddress.toLowerCase() !== network.contracts.usdt.toLowerCase()) {
    throw new Error(`USDT address does not match ${network.name}`);
  }

  const usesMainnetHost = rpcUrl.includes("rpc.botchain.ai") || explorerUrl.includes("scan.botchain.ai");
  const usesTestnetHost = rpcUrl.includes("rpc.bohr.life") || explorerUrl.includes("scan.bohr.life");
  if (network.id === botChainTestnet.id && usesMainnetHost) {
    throw new Error("RPC or explorer URL does not match BOT Chain Testnet");
  }
  if (network.id === botChainMainnet.id && usesTestnetHost) {
    throw new Error("RPC or explorer URL does not match BOT Chain Mainnet");
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const requestedChainId = Number(env.BOT_CHAIN_ID);
  const artifact = loadArtifact(
    env,
    Number.isInteger(requestedChainId) && requestedChainId > 0 ? requestedChainId : undefined,
  );
  const chainId = Number(env.BOT_CHAIN_ID ?? artifact?.chainId ?? botChainTestnet.id);
  const network = botChainById(chainId);
  if (!network) {
    throw new Error(`Unsupported BOT Chain ID ${chainId}`);
  }
  const rpcUrl = env.BOT_CHAIN_RPC_URL?.trim() || artifact?.rpcUrl || network.rpcUrl;
  const explorerUrl = env.BOT_CHAIN_EXPLORER_URL?.trim() || artifact?.explorerUrl || network.explorerUrl;
  const usdtAddress = address(
    env.USDT_ADDRESS?.trim() || env.TESTNET_USDT_ADDRESS?.trim() || artifact?.usdt.address || network.contracts.usdt,
    "USDT_ADDRESS",
  );
  assertNetworkPairing(network, rpcUrl, explorerUrl, usdtAddress);

  const modelProviderValue = (env.MODEL_PROVIDER?.trim().toLowerCase() || "openai-compatible") as ModelProvider;
  if (modelProviderValue !== "openai-compatible" && modelProviderValue !== "gemini") {
    throw new Error("MODEL_PROVIDER must be openai-compatible or gemini");
  }

  const decisionStoreBackend = (env.DECISION_STORE_BACKEND?.trim().toLowerCase() || "file") as
    | "file"
    | "supabase";
  if (decisionStoreBackend !== "file" && decisionStoreBackend !== "supabase") {
    throw new Error("DECISION_STORE_BACKEND must be file or supabase");
  }
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (decisionStoreBackend === "supabase" && (!supabaseUrl || !supabaseServiceRoleKey)) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase store");
  }
  if ((supabaseUrl && !supabaseServiceRoleKey) || (!supabaseUrl && supabaseServiceRoleKey)) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together");
  }
  if (supabaseUrl) {
    let parsedSupabaseUrl: URL;
    try {
      parsedSupabaseUrl = new URL(supabaseUrl);
    } catch {
      throw new Error("SUPABASE_URL must be a valid URL");
    }
    if (parsedSupabaseUrl.protocol !== "https:") {
      throw new Error("SUPABASE_URL must use HTTPS");
    }
  }

  const allowedOrigins = (env.AGENT_ALLOWED_ORIGINS?.trim() ||
    (env.NODE_ENV === "production" ? "" : "http://localhost:3000"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.includes("*")) {
    throw new Error("AGENT_ALLOWED_ORIGINS cannot contain a wildcard");
  }
  for (const origin of allowedOrigins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`AGENT_ALLOWED_ORIGINS contains an invalid URL: ${origin}`);
    }
    const localOrigin = parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1";
    if (parsedOrigin.protocol !== "https:" && !(env.NODE_ENV !== "production" && localOrigin)) {
      throw new Error(`AGENT_ALLOWED_ORIGINS must use HTTPS: ${origin}`);
    }
  }
  if (env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error("AGENT_ALLOWED_ORIGINS is required in production");
  }

  const modelBaseUrl = env.MODEL_BASE_URL?.trim()
    || (modelProviderValue === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta"
      : "https://api.groq.com/openai/v1");
  validateModelEndpoint(modelProviderValue, modelBaseUrl, env.NODE_ENV !== "production");

  const keeperPrivateKeyValue = required(env, "KEEPER_PRIVATE_KEY");
  const keeperPrivateKey = /^[a-fA-F0-9]{64}$/.test(keeperPrivateKeyValue)
    ? `0x${keeperPrivateKeyValue}`
    : keeperPrivateKeyValue;
  if (!/^0x[a-fA-F0-9]{64}$/.test(keeperPrivateKey)) {
    throw new Error("KEEPER_PRIVATE_KEY must be a 32-byte hex private key");
  }

  const modelTimeoutMs = Number(env.MODEL_TIMEOUT_MS ?? 8_000);
  if (!Number.isInteger(modelTimeoutMs) || modelTimeoutMs <= 0) {
    throw new Error("MODEL_TIMEOUT_MS must be a positive integer");
  }

  const apiKey = required(env, "AGENT_API_KEY");
  if (apiKey.length < 32) throw new Error("AGENT_API_KEY must be at least 32 characters");

  return {
    port: positiveInteger(env, "PORT", 8787),
    version: env.GREN_AGENT_VERSION?.trim() || "0.1.0",
    rpcUrl,
    chainId,
    explorerUrl,
    usdtAddress,
    vaults: addressMap(env, artifact, "vaults"),
    reserveStrategies: addressMap(env, artifact, "strategies"),
    bdexStrategies: loadBdexStrategies(env, artifact),
    apiKey,
    keeperPrivateKey: keeperPrivateKey as Hex,
    decisionStorePath: resolveRepoPath(env.DECISION_STORE_PATH?.trim() || ".agent/decisions.json"),
    decisionStoreBackend,
    supabaseUrl,
    supabaseServiceRoleKey,
    maxDecisionRecords: positiveInteger(env, "DECISION_MAX_RECORDS", 10_000),
    decisionRetentionMs: positiveInteger(env, "DECISION_RETENTION_MS", 7 * 24 * 60 * 60 * 1_000),
    allowedOrigins,
    maxRequestBodyBytes: positiveInteger(env, "AGENT_MAX_REQUEST_BODY_BYTES", 64 * 1024),
    rateLimitWindowMs: positiveInteger(env, "AGENT_RATE_LIMIT_WINDOW_MS", 60_000),
    previewRateLimit: positiveInteger(env, "AGENT_PREVIEW_RATE_LIMIT", 30),
    statusRateLimit: positiveInteger(env, "AGENT_STATUS_RATE_LIMIT", 60),
    modelProvider: modelProviderValue,
    modelBaseUrl,
    modelApiKey: modelProviderValue === "gemini"
      ? firstPresent(env, ["GEMINI_API_KEY", "MODEL_API_KEY"])
      : firstPresent(env, ["MODEL_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "XAI_API_KEY"]),
    modelName: env.MODEL_NAME?.trim()
      || (modelProviderValue === "gemini" ? "gemini-2.0-flash" : "openai/gpt-oss-20b"),
    modelTimeoutMs,
  };
}

function validateModelEndpoint(
  provider: ModelProvider,
  value: string,
  allowLocalhost: boolean,
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MODEL_BASE_URL must be a valid URL");
  }
  if (allowLocalhost && url.hostname === "localhost" && url.protocol === "http:") return;
  if (url.protocol !== "https:") throw new Error("MODEL_BASE_URL must use HTTPS");

  const allowedHosts = provider === "gemini"
    ? ["generativelanguage.googleapis.com"]
    : ["api.groq.com", "api.openai.com", "openrouter.ai", "api.cerebras.ai", "api.x.ai"];
  if (!allowedHosts.includes(url.hostname)) {
    throw new Error(`MODEL_BASE_URL host is not allowlisted for ${provider}`);
  }
}

function firstPresent(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}
