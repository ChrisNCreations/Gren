import Link from "next/link";

export function LandingHero() {
  return (
    <section className="landingHero" id="top">
      <div className="landingHeroWash" aria-hidden="true" />

      <div className="landingArtifact landingArtifactMarkets" data-parallax="-36">
        <div className="landingArtifactLabel">Balanced policy</div>
        <div className="landingArtifactValue">45%</div>
        <div className="landingMiniBars" aria-hidden="true">
          <i style={{ height: "36%" }} /><i style={{ height: "63%" }} /><i style={{ height: "48%" }} /><i style={{ height: "82%" }} /><i style={{ height: "70%" }} />
        </div>
        <small>Maximum BDEX exposure</small>
      </div>

      <div className="landingArtifact landingArtifactAllocation" data-parallax="28">
        <div className="landingArtifactLabel">Target allocation</div>
        <div className="landingHeroRing" aria-hidden="true"><span>55%</span></div>
        <small>Protected reserve</small>
      </div>

      <div className="landingArtifact landingArtifactDecision" data-parallax="-18">
        <div className="landingArtifactLabel">Latest decision</div>
        <div className="landingArtifactValue">Within limits</div>
        <small>Policy accepted the proposal</small>
      </div>

      <div className="landingArtifact landingArtifactComposer" data-parallax="34">
        Why did Gren rebalance?
        <span aria-hidden="true">↑</span>
      </div>

      <div className="landingHeroContent">
        <div className="landingEyebrow">
          <span className="landingStatusDot" />
          Policy-bounded vaults on BOT Chain
        </div>
        <h1>Autonomous portfolio<br />management, <em>with a reason.</em></h1>
        <p>
          Deposit USDT once. Gren evaluates approved signals, proposes a bounded
          allocation, and explains every decision the contracts allow through.
        </p>
        <div className="landingActions">
          <Link className="landingPill landingPillDark landingPillLarge" href="/app">Open vault</Link>
          <a className="landingPill landingPillOutline landingPillLarge" href="#intelligence">
            See how it works <span>→</span>
          </a>
        </div>
        <div className="landingProof">
          <span>USDT vaults</span>
          <span>BOT Chain testnet</span>
          <span>Explainable decisions</span>
        </div>
      </div>
    </section>
  );
}
