import { ChevronRight, ShieldCheck } from "lucide-react";
import { type ProfileId, vaultProfiles } from "@/lib/dashboard";

export function VaultsView({
  profileId,
  onProfileChange,
}: {
  profileId: ProfileId;
  onProfileChange: (profile: ProfileId) => void;
}) {
  return (
    <div className="vaultList">
      {(Object.keys(vaultProfiles) as ProfileId[]).map((id) => {
        const profile = vaultProfiles[id];
        const selected = profileId === id;

        return (
          <button
            className={`vaultCard vaultCard--${profile.accent} revealItem ${selected ? "isSelected" : ""}`}
            key={id}
            onClick={() => onProfileChange(id)}
            type="button"
          >
            <span className="vaultCardTop">
              <ShieldCheck size={18} />
              <small>{selected ? "Selected" : "Available policy"}</small>
            </span>
            <span className="vaultCardTitle">{profile.name}</span>
            <span className="vaultCardCopy">{profile.summary}</span>
            <span className="vaultStats">
              <span><small>Maximum BDEX</small><strong>{profile.dex}%</strong></span>
              <span><small>Maximum slippage</small><strong>{profile.slippage}</strong></span>
            </span>
            <span className="vaultCardAction">Use this vault <ChevronRight size={15} /></span>
          </button>
        );
      })}
    </div>
  );
}
