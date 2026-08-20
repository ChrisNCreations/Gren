import { botChainById, botChainTestnet, profileIndexes, type RiskProfile } from "@gren/shared";
import { getAddress, type Address } from "viem";

function configuredUrl(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function configuredAddress(value: string | undefined): Address | undefined {
  if (!value?.trim()) return undefined;
  try {
    return getAddress(value.trim());
  } catch {
    return undefined;
  }
}

const configuredChainId = Number(
  process.env.NEXT_PUBLIC_BOT_CHAIN_ID?.trim() || botChainTestnet.id,
);
const network = botChainById(configuredChainId);
if (!network) {
  throw new Error(`Unsupported BOT Chain ID ${configuredChainId}`);
}

const usdtAddress = configuredAddress(
  process.env.NEXT_PUBLIC_USDT_ADDRESS || network.contracts.usdt,
);
if (!usdtAddress || usdtAddress.toLowerCase() !== network.contracts.usdt.toLowerCase()) {
  throw new Error(`NEXT_PUBLIC_USDT_ADDRESS does not match the verified ${network.name} USDT`);
}

const rpcUrl = configuredUrl("NEXT_PUBLIC_BOT_CHAIN_RPC_URL", network.rpcUrl);
const explorerUrl = configuredUrl("NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL", network.explorerUrl);
const usesMainnetHost = rpcUrl.includes("rpc.botchain.ai") || explorerUrl.includes("scan.botchain.ai");
const usesTestnetHost = rpcUrl.includes("rpc.bohr.life") || explorerUrl.includes("scan.bohr.life");
if (network.id === botChainTestnet.id && usesMainnetHost) {
  throw new Error("Public RPC or explorer URL does not match BOT Chain Testnet");
}
if (network.id !== botChainTestnet.id && usesTestnetHost) {
  throw new Error("Public RPC or explorer URL does not match BOT Chain Mainnet");
}

const configuredDeployedAtBlock = Number(process.env.NEXT_PUBLIC_DEPLOYED_AT_BLOCK?.trim() || network.deployedAtBlock);

export const publicChainConfig = {
  chainId: configuredChainId,
  name: network.name,
  isTestnet: network.id === botChainTestnet.id,
  rpcUrl,
  explorerUrl,
  usdtAddress,
  usdtDecimals: network.usdtDecimals,
  deployedAtBlock: Number.isInteger(configuredDeployedAtBlock) && configuredDeployedAtBlock >= 0
    ? configuredDeployedAtBlock
    : network.deployedAtBlock,
  bdexEnabled: false as const,
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL?.trim() || undefined,
  vaults: {
    conservative: configuredAddress(process.env.NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS),
    balanced: configuredAddress(process.env.NEXT_PUBLIC_BALANCED_VAULT_ADDRESS),
    aggressive: configuredAddress(process.env.NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS),
  } satisfies Record<RiskProfile, Address | undefined>,
} as const;

export function expectedVaultProfile(profile: RiskProfile): number {
  return profileIndexes[profile];
}

export function isSecureAgentUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return process.env.NODE_ENV !== "production" && url.hostname === "localhost";
  } catch {
    return false;
  }
}
