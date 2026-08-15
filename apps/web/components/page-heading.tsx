import { ArrowDownToLine, Plus } from "lucide-react";
import type { ViewId } from "@/lib/dashboard";

export function PageHeading({ activeView, label }: { activeView: ViewId; label: string }) {
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
        <button className="secondaryButton" type="button" disabled>
          <ArrowDownToLine size={15} /> Withdraw
        </button>
        <button className="primaryButton" type="button">
          <Plus size={15} /> Deposit
        </button>
      </div>
    </div>
  );
}
