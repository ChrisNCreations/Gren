"use client";

import { useMemo } from "react";
import { useEffect, useState } from "react";
import { publicChainConfig } from "@/lib/public-config";
import { parseAbiItem, type Address, type Hash } from "viem";
import { usePublicClient } from "wagmi";

import { publicVaultEntries } from "@/lib/agent";
import { botChain } from "@/lib/wagmi";
import type { ProfileId } from "@/lib/dashboard";

const depositedEvent = parseAbiItem("event Deposited(address indexed user, uint256 assets, uint256 shares)");
const withdrawnEvent = parseAbiItem("event Withdrawn(address indexed user, uint256 assets, uint256 shares)");

export type VaultActivityItem = {
  kind: "deposit" | "withdraw";
  profileId: ProfileId;
  assets: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
};

export function useVaultActivity(options: {
  address?: Address;
  enabled?: boolean;
  refreshKey?: number;
}): { items: VaultActivityItem[]; isLoading: boolean; error: boolean } {
  const { address, enabled = true, refreshKey = 0 } = options;
  const publicClient = usePublicClient({ chainId: botChain.id });
  const vaultEntries = useMemo(() => publicVaultEntries(), []);
  const [items, setItems] = useState<VaultActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || !address || !enabled || vaultEntries.length === 0) {
      setItems([]);
      setError(false);
      return () => {
        cancelled = true;
      };
    }
    const client = publicClient;
    const addresses = vaultEntries.map(({ address: vault }) => vault);
    const fromBlock = BigInt(publicChainConfig.deployedAtBlock);

    async function loadActivity() {
      setIsLoading(true);
      try {
        const [deposits, withdrawals] = await Promise.all([
          client.getLogs({
            address: addresses,
            event: depositedEvent,
            args: { user: address },
            fromBlock,
          }),
          client.getLogs({
            address: addresses,
            event: withdrawnEvent,
            args: { user: address },
            fromBlock,
          }),
        ]);
        if (cancelled) return;

        const nextItems: VaultActivityItem[] = [];
        for (const log of deposits) {
          const entry = vaultEntries.find(({ address: vault }) => vault.toLowerCase() === log.address.toLowerCase());
          if (!entry || typeof log.args.assets !== "bigint" || !log.transactionHash) continue;
          nextItems.push({
            kind: "deposit",
            profileId: entry.profileId,
            assets: log.args.assets,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
        for (const log of withdrawals) {
          const entry = vaultEntries.find(({ address: vault }) => vault.toLowerCase() === log.address.toLowerCase());
          if (!entry || typeof log.args.assets !== "bigint" || !log.transactionHash) continue;
          nextItems.push({
            kind: "withdraw",
            profileId: entry.profileId,
            assets: log.args.assets,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
        nextItems.sort((left, right) => Number(right.blockNumber - left.blockNumber));

        setItems(nextItems.slice(0, 20));
        setError(false);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadActivity();
    return () => {
      cancelled = true;
    };
  }, [publicClient, address, enabled, refreshKey, vaultEntries]);

  return { items, isLoading, error };
}