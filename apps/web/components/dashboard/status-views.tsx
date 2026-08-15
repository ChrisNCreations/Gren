import { Check, Clock3, Sparkles, Wallet } from "lucide-react";

export function DecisionsView() {
  return (
    <section className="emptyPage revealItem">
      <span className="emptyPageIcon"><Sparkles size={22} /></span>
      <h2>Your decision ledger starts here.</h2>
      <p>Every accepted, rejected, and executed proposal will retain its reason code, input hash, policy result, and explorer transaction.</p>
      <div className="ledgerPreview" aria-label="Decision ledger fields">
        <span>Reason</span><span>Policy result</span><span>Input hash</span><span>Transaction</span>
      </div>
    </section>
  );
}

export function ActivityView() {
  return (
    <section className="activityTimeline revealItem">
      <div className="timelineItem isReady">
        <span><Check size={14} /></span>
        <div><strong>Application workspace</strong><small>Production interface and shared schemas are ready.</small></div>
        <time>Ready</time>
      </div>
      <div className="timelineItem">
        <span><Clock3 size={14} /></span>
        <div><strong>Vault contracts</strong><small>Awaiting verified testnet integration and deployment.</small></div>
        <time>Pending</time>
      </div>
      <div className="timelineItem">
        <span><Wallet size={14} /></span>
        <div><strong>Wallet session</strong><small>No wallet is connected to this browser session.</small></div>
        <time>Idle</time>
      </div>
    </section>
  );
}
