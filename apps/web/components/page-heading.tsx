import { ArrowDownToLine, Plus } from "lucide-react";
import type { ViewId } from "@/lib/dashboard";

export function PageHeading({
  activeView,
  label,
  onDeposit,
  onWithdraw,
}: {
  activeView: ViewId;
  label: string;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  return (
    <div className="pageHeading revealItem">
      <div>
        <span className="eyebrow">Autonomous vault workspace</span>
        <h1>{activeView === "overview" ? "Good morning." : label}</h1>
        <p>
          {activeView === "overview"
            ? "Your assets, policy boundaries, and agent decisions in one place."
            : `Review your ${label.toLowerCase()} workspace.`}
        </p>
      </div>
      <div className="pageActions">
        <button className="secondaryButton" type="button" onClick={onWithdraw}>
          <ArrowDownToLine size={15} /> Withdraw
        </button>
        <button className="primaryButton" type="button" onClick={onDeposit}>
          <Plus size={15} /> Deposit
        </button>
      </div>
    </div>
  );
}
