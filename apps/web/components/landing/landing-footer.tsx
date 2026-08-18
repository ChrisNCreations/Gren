import { botChainTestnet } from "@gren/shared";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function LandingFooter() {
  return (
    <footer className="landingFooter">
      <div className="landingFooterMain">
        <div className="landingFooterBrand">
          <span className="landingBrand"><BrandMark /><span>Gren</span></span>
          <p>AI-guided USDT vaults with on-chain policy bounds on BOT Chain Testnet.</p>
        </div>
        <div>
          <span>Product</span>
          <a href="#product">Promises</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#security">Architecture</a>
        </div>
        <div>
          <span>Workspace</span>
          <Link href="/app">Open vault</Link>
          <Link href="/app">Overview</Link>
          <Link href="/app">Decisions</Link>
        </div>
        <div>
          <span>Network</span>
          <a href={botChainTestnet.explorerUrl} rel="noreferrer" target="_blank">Explorer</a>
          <span>BOT Chain Testnet</span>
          <span>Chain ID {botChainTestnet.id}</span>
        </div>
      </div>
      <div className="landingFooterBottom">
        <span>Testnet only. No yield claims. Withdrawals do not depend on the agent.</span>
        <span>Gren</span>
      </div>
    </footer>
  );
}
