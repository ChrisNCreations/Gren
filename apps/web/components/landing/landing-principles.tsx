export function LandingPrinciples() {
  return (
    <section className="landingSection landingPrinciples" id="product">
      <div className="landingSectionHeading landingReveal">
        <span className="landingEyebrow">A calmer way to allocate</span>
        <h2>One deposit. Three clear promises.</h2>
      </div>
      <div className="landingPrincipleGrid">
        <article className="landingPrincipleCard landingPrincipleCardAccent landingReveal">
          <span className="landingCardIndex">01</span>
          <h3>Policy before prediction</h3>
          <div className="landingPolicyVisual" aria-hidden="true">
            <span>Risk</span><i /><span>Signals</span><i /><span>Action</span>
          </div>
          <p>
            Conservative, Balanced, and Aggressive vaults carry fixed on-chain
            limits. The model proposes; the policy engine decides what is allowed.
          </p>
        </article>
        <article className="landingPrincipleCard landingReveal">
          <span className="landingCardIndex">02</span>
          <h3>Every move is visible</h3>
          <div className="landingLedger" aria-hidden="true">
            <span><b>Decision</b><small>Reason + hash</small></span>
            <span><b>Policy</b><small>Accepted or rejected</small></span>
            <span><b>Execution</b><small>Explorer link</small></span>
          </div>
          <p>
            Target allocation, reason, policy result, and explorer evidence stay
            connected in one operating timeline.
          </p>
        </article>
        <article className="landingPrincipleCard landingReveal">
          <span className="landingCardIndex">03</span>
          <h3>Your capital stays yours</h3>
          <div className="landingControlVisual" aria-hidden="true">
            <div className="landingControlOrbit"><span>Vault</span></div>
            <span className="landingControlNode landingControlNodeOne">Deposit</span>
            <span className="landingControlNode landingControlNodeTwo">Withdraw</span>
            <span className="landingControlNode landingControlNodeThree">Limits</span>
          </div>
          <p>
            Withdraw at any time. The agent can propose a rebalance, but it
            cannot submit arbitrary calldata or move funds off-policy.
          </p>
        </article>
      </div>
    </section>
  );
}
