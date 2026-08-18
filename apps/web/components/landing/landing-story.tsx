export function LandingStory() {
  return (
    <section className="landingStory" id="intelligence">
      <div className="landingStorySticky">
        <div>
          <span className="landingEyebrow">How Gren thinks</span>
          <div className="landingStoryStack">
            <article className="landingStoryScene isActive" data-story-scene="0">
              <h2>Read the full position.</h2>
              <p>Gren combines vault balances, approved market inputs, and the risk profile you selected on-chain.</p>
            </article>
            <article className="landingStoryScene" data-story-scene="1">
              <h2>Decide inside the guardrails.</h2>
              <p>The AI returns a structured allocation. Contract policy enforces exposure, slippage, and strategy limits.</p>
            </article>
            <article className="landingStoryScene" data-story-scene="2">
              <h2>Execute, then explain.</h2>
              <p>A restricted keeper submits the action. Gren links the outcome, transaction, and plain-language reasoning.</p>
            </article>
          </div>
          <div className="landingStoryProgress" aria-label="Story progress">
            <i className="isActive" /><i /><i />
          </div>
        </div>

        <div className="landingProduct" aria-label="Gren product workflow preview">
          <div className="landingChrome">
            <span className="landingChromeDots"><i /><i /><i /></span>
            <span>Gren vault</span>
            <small>BOT Chain · Testnet</small>
          </div>
          <div className="landingProductSidebar">
            <span className="landingProductBrand"><b>G</b> Gren</span>
            <span className="isActive">Overview</span>
            <span>Vaults</span>
            <span>Decisions</span>
            <span>Activity</span>
            <small>Agent service ready</small>
          </div>
          <div className="landingProductStage">
            <article className="landingStagePanel isActive" data-stage-panel="0">
              <div className="landingStageKicker">Balanced vault policy</div>
              <div className="landingStageMetric">55%</div>
              <div className="landingStageNote">Protected reserve target</div>
              <div className="landingStageChart" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="landingStageRow"><span>Protected reserve</span><b>55%</b></div>
              <div className="landingStageRow"><span>Maximum BDEX</span><b>45%</b></div>
            </article>
            <article className="landingStagePanel" data-stage-panel="1">
              <div className="landingDecisionHeader"><span>Policy evaluation</span><b>Accepted</b></div>
              <div className="landingDecisionSignal"><span>Risk profile</span><strong>Balanced</strong><small>Max DEX 45%</small></div>
              <div className="landingDecisionSignal"><span>Proposed shift</span><strong>Within cap</strong><small>Reserve first</small></div>
              <div className="landingDecisionSignal"><span>Slippage bound</span><strong>0.8%</strong><small>On-chain limit</small></div>
              <div className="landingDecisionBar" aria-hidden="true"><i /><span>55% protected</span><span>45% max DEX</span></div>
            </article>
            <article className="landingStagePanel landingStagePanelReceipt" data-stage-panel="2">
              <div className="landingReceiptStatus"><i /> Decision recorded</div>
              <h3>Keep the reserve, then explain.</h3>
              <p>
                The keeper can submit only a schema-valid decision. The vault
                still enforces the policy, then the workspace shows the reason
                and explorer evidence.
              </p>
              <dl>
                <div><dt>Input</dt><dd>Hashed snapshot</dd></div>
                <div><dt>Policy</dt><dd>Accepted or rejected</dd></div>
                <div><dt>Proof</dt><dd>Explorer after execution</dd></div>
              </dl>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
