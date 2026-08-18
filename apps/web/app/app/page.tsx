"use client";

import { botChainTestnet } from "@gren/shared";
import { ExternalLink, Menu } from "lucide-react";
import { useRef, useState } from "react";
import { AppSidebar, viewLabels } from "@/components/app-sidebar";
import { OverviewView } from "@/components/dashboard/overview-view";
import { ActivityView, DecisionsView } from "@/components/dashboard/status-views";
import { VaultsView } from "@/components/dashboard/vaults-view";
import { PageHeading } from "@/components/page-heading";
import { TransactionModal } from "@/components/transaction-modal";
import { WalletControl } from "@/components/wallet-control";
import { useRevealMotion } from "@/hooks/use-reveal-motion";
import type { ProfileId, ViewId } from "@/lib/dashboard";

export default function AppPage() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [profileId, setProfileId] = useState<ProfileId>("balanced");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<"deposit" | "withdraw" | null>(null);
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
            <a href={botChainTestnet.explorerUrl} target="_blank" rel="noreferrer">
              Explorer <ExternalLink size={12} />
            </a>
            <WalletControl />
          </div>
        </header>

        <div className="contentFrame">
          <PageHeading
            activeView={activeView}
            label={currentLabel}
            onDeposit={() => setTransactionMode("deposit")}
            onWithdraw={() => setTransactionMode("withdraw")}
          />

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
      {transactionMode && (
        <TransactionModal
          mode={transactionMode}
          profileId={profileId}
          onClose={() => setTransactionMode(null)}
        />
      )}
    </div>
  );
}
