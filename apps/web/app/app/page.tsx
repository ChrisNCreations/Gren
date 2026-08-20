"use client";

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
import { publicChainConfig } from "@/lib/public-config";

export default function AppPage() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [profileId, setProfileId] = useState<ProfileId>("balanced");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<"deposit" | "withdraw" | null>(null);
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [decisionsRefreshKey, setDecisionsRefreshKey] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);

  useRevealMotion(shellRef, activeView);

  const currentLabel = viewLabels[activeView];

  function handleDepositConfirmed() {
    setPortfolioRefreshKey((value) => value + 1);
    setActivityRefreshKey((value) => value + 1);
    setDecisionsRefreshKey((value) => value + 1);
  }

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
            <a href={publicChainConfig.explorerUrl} target="_blank" rel="noreferrer">
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
            <OverviewView
              profileId={profileId}
              onProfileChange={setProfileId}
              refreshKey={portfolioRefreshKey}
              onDecisionExecuted={() => setDecisionsRefreshKey((value) => value + 1)}
            />
          )}
          {activeView === "vaults" && (
            <VaultsView profileId={profileId} onProfileChange={setProfileId} />
          )}
          {activeView === "decisions" && <DecisionsView refreshKey={decisionsRefreshKey} />}
          {activeView === "activity" && <ActivityView refreshKey={activityRefreshKey} />}
        </div>
      </main>
      {transactionMode && (
        <TransactionModal
          mode={transactionMode}
          profileId={profileId}
          onClose={() => setTransactionMode(null)}
          onDepositConfirmed={handleDepositConfirmed}
        />
      )}
    </div>
  );
}
