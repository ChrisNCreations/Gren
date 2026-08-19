import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  botChainTestnet,
  grenVaultAbi,
  profileIndexes,
  reserveStrategyAbi,
  usdtAbi,
  type RiskProfile,
} from "@gren/shared";

import type { AgentConfig } from "../config.js";

export type ChainClients = {
  account: Account;
  chain: Chain;
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export type VaultSnapshot = {
  vault: Address;
  strategy: Address;
  profile: number;
  totalAssets: bigint;
  totalShares: bigint;
  reserveBps: number;
  dexBps: number;
  policyVersion: bigint;
  observedAt: number;
};

const ROLE_NAMES = {
  defaultAdmin: "",
  policyAdmin: "POLICY_ADMIN_ROLE",
  pauser: "PAUSER_ROLE",
  keeper: "KEEPER_ROLE",
} as const;

function roleHash(name: string): Hex {
  return name ? keccak256(toBytes(name)) : ("0x" + "0".repeat(64)) as Hex;
}

async function readVault<T>(
  publicClient: PublicClient,
  address: Address,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> {
  return publicClient.readContract({
    address,
    abi: grenVaultAbi,
    functionName: functionName as never,
    args: args as never,
  } as never) as Promise<T>;
}

export function createChainClients(config: AgentConfig): ChainClients {
  const chain = defineChain({
    id: config.chainId,
    name: botChainTestnet.name,
    nativeCurrency: botChainTestnet.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: "BOTScan", url: config.explorerUrl } },
  });
  const transport = http(config.rpcUrl);
  const account = privateKeyToAccount(config.keeperPrivateKey);

  return {
    account,
    chain,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };
}

export async function verifyTestnet(
  clients: ChainClients,
  config: AgentConfig,
): Promise<void> {
  const chainId = await clients.publicClient.getChainId();
  if (chainId !== botChainTestnet.id) {
    throw new Error(`RPC returned chain ${chainId}; expected ${botChainTestnet.id}`);
  }

  const bytecode = await clients.publicClient.getBytecode({ address: config.usdtAddress });
  if (!bytecode || bytecode === "0x") throw new Error("Configured testnet USDT has no bytecode");

  const [decimals, symbol] = await Promise.all([
    clients.publicClient.readContract({
      address: config.usdtAddress,
      abi: usdtAbi,
      functionName: "decimals",
    }),
    clients.publicClient.readContract({
      address: config.usdtAddress,
      abi: usdtAbi,
      functionName: "symbol",
    }),
  ]);
  if (Number(decimals) !== botChainTestnet.usdtDecimals) {
    throw new Error(`Configured USDT decimals are ${String(decimals)}, expected 6`);
  }
  if (symbol !== "USDT") throw new Error(`Configured testnet token symbol is ${String(symbol)}, expected USDT`);

  const profiles = Object.entries(config.vaults) as Array<[RiskProfile, Address]>;
  for (const [profile, vault] of profiles) {
    const strategy = config.reserveStrategies[profile];
    const [vaultCode, strategyCode, vaultAsset, vaultProfile, bdexEnabled, strategyAllowed, strategyVault, strategyAsset] = await Promise.all([
      clients.publicClient.getBytecode({ address: vault }),
      clients.publicClient.getBytecode({ address: strategy }),
      readVault<Address>(clients.publicClient, vault, "asset"),
      readVault<bigint>(clients.publicClient, vault, "profile"),
      readVault<boolean>(clients.publicClient, vault, "bdexEnabled"),
      readVault<boolean>(clients.publicClient, vault, "strategyAllowed", [strategy]),
      clients.publicClient.readContract({
        address: strategy,
        abi: reserveStrategyAbi,
        functionName: "vault",
      }),
      clients.publicClient.readContract({
        address: strategy,
        abi: reserveStrategyAbi,
        functionName: "asset",
      }),
    ]);

    if (!vaultCode || vaultCode === "0x") throw new Error(`Configured ${profile} vault has no bytecode`);
    if (!strategyCode || strategyCode === "0x") throw new Error(`Configured ${profile} strategy has no bytecode`);
    if (vaultAsset.toLowerCase() !== config.usdtAddress.toLowerCase()) {
      throw new Error(`Configured ${profile} vault uses an unexpected asset`);
    }
    if (Number(vaultProfile) !== profileIndexes[profile]) {
      throw new Error(`Configured ${profile} vault has an unexpected profile`);
    }
    if (bdexEnabled) throw new Error(`Configured ${profile} vault unexpectedly enables BDEX`);
    if (!strategyAllowed) throw new Error(`Configured ${profile} strategy is not allowlisted`);
    if (String(strategyVault).toLowerCase() !== vault.toLowerCase()) {
      throw new Error(`Configured ${profile} strategy points to the wrong vault`);
    }
    if (String(strategyAsset).toLowerCase() !== config.usdtAddress.toLowerCase()) {
      throw new Error(`Configured ${profile} strategy uses an unexpected asset`);
    }
  }
}

export async function readVaultSnapshot(
  clients: ChainClients,
  vault: Address,
  strategy: Address,
): Promise<VaultSnapshot> {
  const [profile, totalAssets, totalShares, reserveBps, dexBps, policyVersion, block] =
    await Promise.all([
      readVault<bigint>(clients.publicClient, vault, "profile"),
      readVault<bigint>(clients.publicClient, vault, "totalAssets"),
      readVault<bigint>(clients.publicClient, vault, "totalSupply"),
      readVault<bigint>(clients.publicClient, vault, "currentReserveBps"),
      readVault<bigint>(clients.publicClient, vault, "currentDexBps"),
      readVault<bigint>(clients.publicClient, vault, "policyVersion"),
      clients.publicClient.getBlock({ blockTag: "latest" }),
    ]);

  return {
    vault,
    strategy,
    profile: Number(profile),
    totalAssets,
    totalShares,
    reserveBps: Number(reserveBps),
    dexBps: Number(dexBps),
    policyVersion,
    observedAt: Number(block.timestamp),
  };
}

export async function assertKeeperPermissions(
  clients: ChainClients,
  vaults: Record<RiskProfile, Address>,
): Promise<void> {
  const keeper = clients.account.address;
  for (const vault of Object.values(vaults)) {
    const owner = await readVault<Address>(clients.publicClient, vault, "owner");
    if (owner.toLowerCase() === keeper.toLowerCase()) {
      throw new Error(`Keeper ${keeper} is also owner of ${vault}`);
    }

    for (const [label, role] of Object.entries(ROLE_NAMES)) {
      const hasRole = await clients.publicClient.readContract({
        address: vault,
        abi: grenVaultAbi,
        functionName: "hasRole",
        args: [roleHash(role), keeper],
      });
      if (label !== "keeper" && hasRole) {
        throw new Error(`Keeper has forbidden ${label} role on ${vault}`);
      }
      if (label === "keeper" && !hasRole) {
        throw new Error(`Keeper is not authorized on ${vault}`);
      }
    }
  }
}

export function explorerUrl(config: AgentConfig, hash: Hex): string {
  return `${config.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
