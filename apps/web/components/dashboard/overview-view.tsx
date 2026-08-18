import {
  Activity,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import { AgentPanel } from "@/components/dashboard/agent-panel";
import { type ProfileId, vaultProfiles } from "@/lib/dashboard";

export function OverviewView({
  profileId,
  onProfileChange,
}: {
  profileId: ProfileId;
  onProfileChange: (profile: ProfileId) => void;
}) {
  const profile = vaultProfiles[profileId];

  return (
    <div className="viewStack">
      <section className="portfolioPanel revealItem" aria-labelledby="portfolio-title">
        <div className="portfolioCopy">
          <div>
            <span className="sectionLabel" id="portfolio-title">Portfolio value</span>
            <strong>$0.00</strong>
            <p>No assets deposited</p>
          </div>
          <div className="portfolioMeta">
            <span><CircleDot size={13} /> USDT vaults</span>
            <span>BOT Chain · Testnet pending</span>
          </div>
        </div>

        <div className="portfolioChart" aria-label="Portfolio chart awaiting first deposit">
          <div className="chartEmptyCopy">
            <span>Portfolio history</span>
            <small>Chart begins after your first confirmed deposit</small>
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
              aria-label={`${profile.reserve}% protected reserve and ${profile.dex}% BDEX exposure`}
            >
              <span><b>{profile.reserve}%</b><small>Reserve</small></span>
            </div>
            <div className="allocationLegend">
              <span><i className="legendReserve" /><b>Protected reserve</b><small>{profile.reserve}% target</small></span>
              <span><i className="legendDex" /><b>BDEX exposure</b><small>Up to {profile.dex}%</small></span>
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
          <div><span id="events-title">Latest activity</span><small>On-chain events will appear here</small></div>
          <button className="iconTextButton" type="button">View activity <ChevronRight size={14} /></button>
        </div>
        <div className="emptyEvent">
          <span className="emptyEventIcon"><Activity size={17} /></span>
          <div><strong>No activity yet</strong><small>Deposits, decisions, rebalances, and withdrawals will be recorded in this feed.</small></div>
          <span className="networkTag">Testnet pending</span>
        </div>
      </section>
    </div>
  );
}
