export function LandingProof() {
  return (
    <section className="landingSection landingProofBlock" id="about">
      <div className="landingProofHeading landingReveal">
        <span className="landingEyebrow">A complete operating loop</span>
        <h2>From first deposit to verified decision.</h2>
      </div>
      <div className="landingProofSteps">
        <article className="landingReveal">
          <span>01</span>
          <h3>Connect</h3>
          <p>Switch to BOT Chain Testnet and connect an EVM wallet.</p>
        </article>
        <article className="landingReveal">
          <span>02</span>
          <h3>Allocate</h3>
          <p>Deposit USDT into Conservative, Balanced, or Aggressive.</p>
        </article>
        <article className="landingReveal">
          <span>03</span>
          <h3>Observe</h3>
          <p>Follow AI decisions with reasons, policy results, and explorer links.</p>
        </article>
        <article className="landingReveal">
          <span>04</span>
          <h3>Exit</h3>
          <p>Redeem vault shares and withdraw at any time, even if the agent is down.</p>
        </article>
      </div>
    </section>
  );
}
