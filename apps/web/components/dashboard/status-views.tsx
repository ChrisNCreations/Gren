"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Clock3, ExternalLink, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { botChainTestnet, grenVaultAbi } from "@gren/shared";
import { formatUnits, hexToString, parseAbiItem, type Hash } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useVaultActivity } from "@/hooks/use-vault-activity";
import { publicVaultEntries } from "@/lib/agent";
import { type ProfileId, vaultProfiles } from "@/lib/dashboard";
import { publicChainConfig } from "@/lib/public-config";
import { botChain } from "@/lib/wagmi";

const decimals = publicChainConfig.usdtDecimals;
const decisionAcceptedEvent = parseAbiItem("event DecisionAccepted(bytes32 indexed decisionId, bytes32 inputHash)");
const decisionRejectedEvent = parseAbiItem("event DecisionRejected(bytes32 indexed decisionId, bytes32 reasonCode)");

type LedgerDecision = {
  accepted: boolean;
  profileId: ProfileId;
  decisionId: string;
  detail: string;
  transactionHash: Hash;
  blockNumber: bigint;
};

function shortenHash(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function decodeReasonCode(value: unknown): string {
  if (typeof value !== "string") return "…";
  if (value === "0x" || /^0x0+$/.test(value)) return "RESERVE_ONLY";
  try {
    return hexToString(value as `0x${string}`).replace(/\0+$/g, "") || value.slice(0, 10);
  } catch {
    return value.slice(0, 10);
  }
}

export function DecisionsView({ refreshKey }: { refreshKey: number }) {
  const publicClient = usePublicClient({ chainId: botChain.id });
  const vaultEntries = useMemo(() => publicVaultEntries(), []);
  const [decisions, setDecisions] = useState<LedgerDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicClient || vaultEntries.length === 0) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const client = publicClient;
    const addresses = vaultEntries.map(({ address: vault }) => vault);
    const fromBlock = BigInt(botChainTestnet.deployedAtBlock);

    async function loadDecisions() {
      setIsLoading(true);
      try {
        const [accepted, rejected] = await Promise.all([
          client.getLogs({ address: addresses, event: decisionAcceptedEvent, fromBlock }),
          client.getLogs({ address: addresses, event: decisionRejectedEvent, fromBlock }),
        ]);
        if (cancelled) return;

        const entries: LedgerDecision[] = [];
        for (const log of accepted) {
          const entry = vaultEntries.find(({ address: vault }) => vault.toLowerCase() === log.address.toLowerCase());
          if (!entry || typeof log.args.decisionId !== "string" || !log.transactionHash) continue;
          entries.push({
            accepted: true,
            profileId: entry.profileId,
            decisionId: log.args.decisionId,
            detail: `Input ${shortenHash(String(log.args.inputHash ?? ""))}`,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
        for (const log of rejected) {
          const entry = vaultEntries.find(({ address: vault }) => vault.toLowerCase() === log.address.toLowerCase());
          if (!entry || typeof log.args.decisionId !== "string" || !log.transactionHash) continue;
          entries.push({
            accepted: false,
            profileId: entry.profileId,
            decisionId: log.args.decisionId,
            detail: decodeReasonCode(log.args.reasonCode),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
        entries.sort((left, right) => Number(right.blockNumber - left.blockNumber));

        setDecisions(entries.slice(0, 20));
        setError(false);
      } catch {
        if (!cancelled) {
          setDecisions([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadDecisions();
    return () => {
      cancelled = true;
    };
  }, [publicClient, vaultEntries, refreshKey]);

  if (isLoading && decisions.length === 0) {
    return (
      <section className="emptyPage revealItem">
        <span className="emptyPageIcon"><Clock3 size={22} /></span>
        <h2>Reading the decision ledger.</h2>
        <p>Fetching accepted and rejected decisions from the BOT Chain vaults.</p>
      </section>
    );
  }

  if (error && decisions.length === 0) {
    return (
      <section className="emptyPage revealItem">
        <span className="emptyPageIcon"><ShieldAlert size={22} /></span>
        <h2>Ledger unavailable.</h2>
        <p>The chain event feed could not be read. Agent execution and withdrawals are unaffected.</p>
      </section>
    );
  }

  if (decisions.length === 0) {
    return (
      <section className="emptyPage revealItem">
        <span className="emptyPageIcon"><Sparkles size={22} /></span>
        <h2>Your decision ledger starts here.</h2>
        <p>Every accepted and rejected proposal is recorded on-chain with its reason, input hash, policy result, and transaction.</p>
        <div className="ledgerPreview" aria-label="Decision ledger fields">
          <span>Reason</span><span>Policy result</span><span>Input hash</span><span>Transaction</span>
        </div>
      </section>
    );
  }

  return (
    <section className="activityTimeline revealItem" aria-label="Decision ledger">
      <div className="ledgerPreview ledgerPreview--inline" aria-hidden="true">
        <span>Policy result</span><span>Vault</span><span>Detail</span><span>Transaction</span>
      </div>
      {decisions.map((decision) => (
        <div className={`timelineItem ${decision.accepted ? "isReady" : ""}`} key={decision.decisionId}>
          <span>{decision.accepted ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}</span>
          <div>
            <strong>{decision.accepted ? "Decision accepted" : "Decision rejected"}</strong>
            <small>{vaultProfiles[decision.profileId].name} vault · {decision.accepted ? decision.detail : `Reason ${decision.detail}`} · {shortenHash(decision.decisionId)}</small>
          </div>
          <time><a className="eventLink" href={`${publicChainConfig.explorerUrl}/tx/${decision.transactionHash}`} target="_blank" rel="noreferrer">View <ExternalLink size={12} /></a></time>
        </div>
      ))}
    </section>
  );
}

export function ActivityView({ refreshKey }: { refreshKey: number }) {
  const { address, chainId, isConnected } = useAccount();
  const isOnTargetChain = chainId === botChain.id;
  const activity = useVaultActivity({
    address,
    enabled: Boolean(address && isConnected && isOnTargetChain),
    refreshKey,
  });

  if (activity.isLoading && activity.items.length === 0) {
    return (
      <section className="activityTimeline revealItem">
        <div className="timelineItem">
          <span><Clock3 size={15} /></span>
          <div><strong>Reading vault events</strong><small>Fetching deposits and withdrawals from BOT Chain.</small></div>
          <time>Reading</time>
        </div>
      </section>
    );
  }

  if (activity.items.length === 0) {
    return (
      <section className="activityTimeline revealItem">
        <div className="timelineItem">
          <span><Activity size={15} /></span>
          <div><strong>No activity yet</strong><small>{activity.error ? "The chain event feed could not be read." : "Deposits and withdrawals for your connected wallet appear here."}</small></div>
          <time>{activity.error ? "Unavailable" : "Idle"}</time>
        </div>
      </section>
    );
  }

  return (
    <section className="activityTimeline revealItem">
      {activity.items.map((item) => (
        <div className="timelineItem isReady" key={`${item.kind}-${item.transactionHash}-${item.blockNumber}`}>
          <span>{item.kind === "deposit" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span>
          <div>
            <strong>{formatUnits(item.assets, decimals)} USDT {item.kind === "deposit" ? "deposited" : "withdrawn"}</strong>
            <small>{vaultProfiles[item.profileId].name} vault · {shortenHash(item.transactionHash)}</small>
          </div>
          <time><a className="eventLink" href={`${publicChainConfig.explorerUrl}/tx/${item.transactionHash}`} target="_blank" rel="noreferrer">View <ExternalLink size={12} /></a></time>
        </div>
      ))}
    </section>
  );
}