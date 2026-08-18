import Link from "next/link";

export function LandingCta() {
  return (
    <section className="landingCta">
      <div className="landingReveal">
        <span className="landingEyebrow">Your first autonomous vault</span>
        <h2>Put capital to work,<br /><em>without losing the thread.</em></h2>
        <div className="landingActions">
          <Link className="landingPill landingPillDark landingPillLarge" href="/app">Open vault</Link>
          <a className="landingPill landingPillOutline landingPillLarge" href="#product">Read the promises</a>
        </div>
      </div>
      <div className="landingVaultDoor" aria-hidden="true">
        <div />
        <i />
        <span />
      </div>
    </section>
  );
}
