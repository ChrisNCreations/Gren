"use client";

import { ExternalLink, Menu, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { AppSidebar, viewLabels } from "@/components/app-sidebar";
import { OverviewView } from "@/components/dashboard/overview-view";
import { ActivityView, DecisionsView } from "@/components/dashboard/status-views";
import { VaultsView } from "@/components/dashboard/vaults-view";
import { PageHeading } from "@/components/page-heading";
import { useRevealMotion } from "@/hooks/use-reveal-motion";
import type { ProfileId, ViewId } from "@/lib/dashboard";

export default function HomePage() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [profileId, setProfileId] = useState<ProfileId>("balanced");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useRevealMotion(shellRef, activeView);

  const currentLabel = viewLabels[activeView];

  return (
    <div className="appShell" ref={shellRef}>
      <button
        aria-label="Close navigation"
        className={`sidebarScrim ${sidebarOpen ? "isVisible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        type="button"
      />

      <AppSidebar
        activeView={activeView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onViewChange={setActiveView}
      />

      <main className="mainArea" id="main-content">
        <header className="appTopbar">
          <div className="topbarStart">
            <button
              className="mobileMenu"
              onClick={() => setSidebarOpen(true)}
              type="button"
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">Vault <i>/</i> <strong>{currentLabel}</strong></span>
          </div>
          <div className="topbarActions">
            <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
              Explorer <ExternalLink size={12} />
            </a>
            <button className="walletButton" type="button" title="Wallet integration follows testnet contract deployment">
              <span className="walletDot" />
              <span>Connect wallet</span>
              <Wallet size={14} />
            </button>
          </div>
        </header>

        <div className="contentFrame">
          <PageHeading activeView={activeView} label={currentLabel} />

          {activeView === "overview" && (
            <OverviewView profileId={profileId} onProfileChange={setProfileId} />
          )}
          {activeView === "vaults" && (
            <VaultsView profileId={profileId} onProfileChange={setProfileId} />
          )}
          {activeView === "decisions" && <DecisionsView />}
          {activeView === "activity" && <ActivityView />}
        </div>
      </main>
    </div>
  );
}
