import Link from "next/link";

export function LandingArchitecture() {
  return (
    <section className="landingArchitecture" id="security">
      <div className="landingSection landingArchitectureInner">
        <div className="landingArchitectureCopy landingReveal">
          <span className="landingEyebrow landingEyebrowLight">Built for accountable autonomy</span>
          <h2>Intelligence off-chain.<br />Authority on-chain.</h2>
          <p>
            The AI can recommend a structured allocation. Gren’s vault contracts
            remain the final boundary for custody, strategy access, and risk.
          </p>
          <Link className="landingPill landingPillLight" href="/app">
            Inspect the vault <span>→</span>
          </Link>
        </div>
        <div className="landingArchitectureDiagram landingReveal">
          <div className="landingArchitectureNode landingArchitectureSignals">
            <span>Signals</span>
            <small>Vault state · Quotes · Risk</small>
          </div>
          <div className="landingArchitectureNode landingArchitectureAgent">
            <span>Gren agent</span>
            <small>Structured decision</small>
          </div>
          <div className="landingArchitectureNode landingArchitecturePolicy">
            <span>Policy engine</span>
            <small>Limits · Slippage · Access</small>
          </div>
          <div className="landingArchitectureNode landingArchitectureVault">
            <span>BOT Chain vault</span>
            <small>Execute · Emit · Settle</small>
          </div>
          <svg viewBox="0 0 720 360" preserveAspectRatio="none" aria-hidden="true">
            <path className="landingFlowLine" d="M120 90 C230 90 220 180 330 180" />
            <path className="landingFlowLine" d="M390 180 C480 180 470 90 590 90" />
            <path className="landingFlowLine" d="M590 130 C590 220 500 270 390 270" />
          </svg>
        </div>
      </div>
    </section>
  );
}
