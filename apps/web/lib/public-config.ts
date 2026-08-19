import { botChainTestnet, profileIndexes, type RiskProfile } from "@gren/shared";
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
if (!Number.isInteger(configuredChainId) || configuredChainId !== botChainTestnet.id) {
  throw new Error(`Only BOT Chain Testnet (${botChainTestnet.id}) is supported by the web app`);
}

const usdtAddress = configuredAddress(
  process.env.NEXT_PUBLIC_USDT_ADDRESS || botChainTestnet.contracts.usdt,
);
if (!usdtAddress || usdtAddress.toLowerCase() !== botChainTestnet.contracts.usdt.toLowerCase()) {
  throw new Error("NEXT_PUBLIC_USDT_ADDRESS does not match the verified BOT Chain testnet USDT");
}

export const publicChainConfig = {
  chainId: configuredChainId,
  rpcUrl: configuredUrl("NEXT_PUBLIC_BOT_CHAIN_RPC_URL", botChainTestnet.rpcUrl),
  explorerUrl: configuredUrl("NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL", botChainTestnet.explorerUrl),
  usdtAddress,
  usdtDecimals: botChainTestnet.usdtDecimals,
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
