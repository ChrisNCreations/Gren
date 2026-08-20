import {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ViewId } from "@/lib/dashboard";
import { BrandMark } from "./brand-mark";

const navigation: Array<{
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vaults", label: "Vaults", icon: ShieldCheck },
  { id: "decisions", label: "Decisions", icon: Sparkles },
  { id: "activity", label: "Activity", icon: Activity },
];

export const viewLabels = Object.fromEntries(
  navigation.map((item) => [item.id, item.label]),
) as Record<ViewId, string>;

export function AppSidebar({
  activeView,
  isOpen,
  onClose,
  onViewChange,
}: {
  activeView: ViewId;
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: ViewId) => void;
}) {
  return (
    <aside className={`sidebar ${isOpen ? "isOpen" : ""}`}>
      <div className="sidebarHeader">
        <a className="appBrand" href="#main-content" onClick={() => onViewChange("overview")}>
          <BrandMark />
          <span>Gren</span>
        </a>
        <button className="mobileClose" onClick={onClose} type="button" aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Vault navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.id ? "isActive" : ""}
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                onClose();
              }}
              type="button"
            >
              <span><Icon size={16} />{item.label}</span>
              {item.count !== undefined && <small>{item.count}</small>}
            </button>
          );
        })}
      </nav>

      <div className="sidebarFooter">
        <div className="serviceStatus"><i /><span>Agent service ready</span></div>
        <Link href="/">Back to site</Link>
      </div>
    </aside>
  );
}
