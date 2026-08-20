"use client";

import { Activity, ArrowUpRight, Check, ChevronRight, CircleDot, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { grenVaultAbi } from "@gren/shared";
import { formatUnits, zeroAddress } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { AgentPanel } from "@/components/dashboard/agent-panel";
import { useVaultActivity } from "@/hooks/use-vault-activity";
import { type ProfileId, vaultProfiles } from "@/lib/dashboard";
import { publicVaultEntries } from "@/lib/agent";
import { publicChainConfig } from "@/lib/public-config";
import { botChain } from "@/lib/wagmi";

const decimals = publicChainConfig.usdtDecimals;
const profileIds = Object.keys(vaultProfiles) as ProfileId[];
const vaultEntries = publicVaultEntries();

export function OverviewView({
  profileId,
  onProfileChange,
  refreshKey,
}: {
  profileId: ProfileId;
  onProfileChange: (profile: ProfileId) => void;
  refreshKey: number;
}) {
  const profile = vaultProfiles[profileId];
  const { address, chainId, isConnected } = useAccount();
  const isOnTargetChain = chainId === botChain.id;
  const canReadPortfolio = Boolean(address && isConnected && isOnTargetChain && vaultEntries.length > 0);
  const portfolioContracts = vaultEntries.map(({ address: vault }) => ({
    address: vault,
    abi: grenVaultAbi,
    functionName: "maxWithdraw" as const,
    args: [address ?? zeroAddress] as const,
    chainId: botChain.id,
  }));
  const {
    data: portfolioReads,
    isError: isPortfolioError,
    isLoading: isPortfolioLoading,
    refetch: refetchPortfolio,
  } = useReadContracts({
    contracts: portfolioContracts,
    query: { enabled: canReadPortfolio },
  });
  const activity = useVaultActivity({
    address,
    enabled: Boolean(address && isConnected && isOnTargetChain && vaultEntries.length > 0),
    refreshKey,
  });

  useEffect(() => {
    if (refreshKey > 0) void refetchPortfolio();
  }, [refreshKey, refetchPortfolio]);

  const portfolioAssets = portfolioReads?.reduce((total, result) => {
    if (result.status !== "success" || typeof result.result !== "bigint") return total;
    return total + result.result;
  }, 0n) ?? 0n;
  const isReadingPortfolio = canReadPortfolio && (isPortfolioLoading || portfolioReads === undefined);
  const portfolioValue = !isConnected || !isOnTargetChain
    ? "$0.00"
    : isReadingPortfolio
      ? "..."
      : isPortfolioError
        ? "Unavailable"
        : `$${formatUnits(portfolioAssets, decimals)}`;
  const portfolioSubtitle = !isConnected
    ? "Connect a wallet to view your position"
    : !isOnTargetChain
      ? "Switch to BOT Chain Testnet to view your position"
      : isReadingPortfolio
        ? "Reading vault balances"
        : isPortfolioError
          ? "Vault balances unavailable"
          : portfolioAssets > 0n
            ? `${formatUnits(portfolioAssets, decimals)} USDT deposited`
            : "No assets deposited";

  return (
    <div className="viewStack">
      <section className="portfolioPanel revealItem" aria-labelledby="portfolio-title">
        <div className="portfolioCopy">
          <div>
            <span className="sectionLabel" id="portfolio-title">Portfolio value</span>
            <strong data-testid="portfolio-value">{portfolioValue}</strong>
            <p>{portfolioSubtitle}</p>
          </div>
          <div className="portfolioMeta">
            <span><CircleDot size={13} /> USDT vaults</span>
            <span>BOT Chain · Testnet</span>
          </div>
        </div>

        <div className="portfolioChart" aria-label="Portfolio chart awaiting first deposit">
          <div className="chartEmptyCopy">
            <span>Portfolio history</span>
            <small>{portfolioAssets > 0n ? "Live balances from connected vaults" : "Chart begins after your first confirmed deposit"}</small>
          </div>
          <svg viewBox="0 0 760 190" role="img" aria-label="Empty portfolio history chart">
            <defs>
              <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#b8cdbb" stopOpacity="0.34" />
                <stop offset="1" stopColor="#b8cdbb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="chartGrid" d="M0 35H760M0 85H760M0 135H760M0 185H760" />
            <path className="chartArea" d="M0 156 C90 150 126 158 195 145 S325 132 390 136 S505 114 575 121 S690 104 760 96 L760 190 L0 190 Z" />
            <path className="chartLine" d="M0 156 C90 150 126 158 195 145 S325 132 390 136 S505 114 575 121 S690 104 760 96" />
          </svg>
          <div className="chartAxis"><span>Start</span><span>Now</span></div>
        </div>
      </section>

      <div className="overviewGrid">
        <section className="toolPanel revealItem" aria-labelledby="policy-title">
          <div className="panelHeading">
            <div>
              <span id="policy-title">Vault policy</span>
              <small>Select a fixed on-chain risk boundary</small>
            </div>
            <span className="draftBadge">Configuration draft</span>
          </div>

          <div className="policyBody">
            <div
              className="allocationRing"
              style={{
                background: `conic-gradient(#719779 0 ${profile.reserve}%, #d3a487 ${profile.reserve}% 100%)`,
              }}
                aria-label={`${profile.reserve}% protected reserve and ${profile.dex}% BDEX policy cap; BDEX is disabled on testnet`}
            >
              <span><b>{profile.reserve}%</b><small>Reserve</small></span>
            </div>
            <div className="allocationLegend">
              <span><i className="legendReserve" /><b>Protected reserve</b><small>{profile.reserve}% target</small></span>
               <span><i className="legendDex" /><b>BDEX policy cap</b><small>Up to {profile.dex}%; disabled on testnet</small></span>
            </div>
          </div>

          <div className="profileControl" aria-label="Select risk vault">
            {(Object.keys(vaultProfiles) as ProfileId[]).map((id) => (
              <button
                className={profileId === id ? "isActive" : ""}
                key={id}
                onClick={() => onProfileChange(id)}
                type="button"
              >
                {vaultProfiles[id].name}
              </button>
            ))}
          </div>

          <div className="policySummary">
            <p>{profile.summary}</p>
            <dl>
              <div><dt>Max BDEX</dt><dd>{profile.dex}%</dd></div>
              <div><dt>Max slippage</dt><dd>{profile.slippage}</dd></div>
            </dl>
          </div>
        </section>

        <AgentPanel profileId={profileId} />
      </div>

      <section className="eventPanel revealItem" aria-labelledby="events-title">
        <div className="panelHeading">
          <div><span id="events-title">Latest activity</span><small>Verified vault events from your wallet</small></div>
          <button className="iconTextButton" type="button">View activity <ChevronRight size={14} /></button>
        </div>
        {activity.isLoading && activity.items.length === 0 ? (
          <div className="emptyEvent">
            <span className="emptyEventIcon"><Activity size={17} /></span>
            <div><strong>Reading vault events</strong><small>Fetching deposits and withdrawals from BOT Chain.</small></div>
            <span className="networkTag">Reading</span>
          </div>
        ) : activity.error && activity.items.length === 0 ? (
          <div className="emptyEvent">
            <span className="emptyEventIcon"><Activity size={17} /></span>
            <div><strong>Activity unavailable</strong><small>The chain event feed could not be read. Balances and withdrawals are unaffected.</small></div>
            <span className="networkTag">Unavailable</span>
          </div>
        ) : activity.items.length > 0 ? (
          <div className="eventList">
            {activity.items.slice(0, 5).map((item) => (
              <div className="emptyEvent" data-testid="latest-deposit" key={`${item.kind}-${item.transactionHash}-${item.blockNumber}`}>
                <span className="emptyEventIcon">{item.kind === "deposit" ? <Check size={17} /> : <ArrowUpRight size={17} />}</span>
                <div><strong>{formatUnits(item.assets, decimals)} USDT {item.kind === "deposit" ? "deposited" : "withdrawn"}</strong><small>{vaultProfiles[item.profileId].name} vault · Confirmed on BOT Chain</small></div>
                <a className="eventLink" href={`${publicChainConfig.explorerUrl}/tx/${item.transactionHash}`} target="_blank" rel="noreferrer">View <ExternalLink size={12} /></a>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyEvent">
            <span className="emptyEventIcon"><Activity size={17} /></span>
            <div><strong>No activity yet</strong><small>Deposits, withdrawals, decisions, and rebalances for your wallet are recorded in this feed.</small></div>
            <span className="networkTag">No events</span>
          </div>
        )}
      </section>
    </div>
  );
}
