"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Clock3, ShieldCheck } from "lucide-react";
import type { DecisionResponse, StructuredProposal } from "@gren/shared";

import {
  POLICY_REJECT_PROPOSAL,
  previewDecision,
  publicVaultAddress,
} from "@/lib/agent";
import type { ProfileId } from "@/lib/dashboard";

type PreviewState =
  | { status: "idle" }
  | { status: "loading"; mode: "evaluate" | "reject" }
  | { status: "ready"; decision: DecisionResponse }
  | { status: "unavailable"; message: string };

function shortenHash(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function AgentPanel({ profileId }: { profileId: ProfileId }) {
  const vault = publicVaultAddress(profileId);
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "idle" });
  }, [profileId]);

  async function runPreview(proposal?: StructuredProposal, mode: "evaluate" | "reject" = "evaluate") {
    if (!vault) return;
    setState({ status: "loading", mode });
    try {
      const decision = await previewDecision({
        vault,
        profile: profileId,
        ...(proposal ? { proposal } : {}),
      });
      setState({ status: "ready", decision });
    } catch {
      setState({ status: "unavailable", message: "The decision service is unavailable. Withdrawals do not depend on this preview." });
    }
  }

  const decision = state.status === "ready" ? state.decision : undefined;
  const policyStatus = decision?.policy.status;
  const heading = headingFor(state, Boolean(vault));
  const evaluationDone = state.status === "ready" || state.status === "unavailable";
  const policyDone = state.status === "ready";

  return (
    <section className="agentPanel revealItem" aria-labelledby="agent-title">
      <div className="agentHeading">
        <span className="agentIcon"><Bot size={17} /></span>
        <div><span id="agent-title">Gren agent</span><small>Decision service</small></div>
        <span className={`agentStatus ${statusClass(state)}`}><i /> {statusLabel(state, Boolean(vault))}</span>
      </div>

      <div className="agentMessage">
        <span>Current state</span>
        <h2>{heading.title}</h2>
        <p>{heading.body}</p>
        {decision ? (
          <dl className="agentMeta">
            <div>
              <dt>Policy</dt>
              <dd data-testid="decision-policy-status">{decision.policy.status}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{decision.reasonCode}</dd>
            </div>
            <div>
              <dt>Allocation</dt>
              <dd>{decision.allocation.reserveBps} / {decision.allocation.dexBps} bps</dd>
            </div>
            <div>
              <dt>Input hash</dt>
              <dd><code>{shortenHash(decision.inputHash)}</code></dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="agentActions">
        <button
          className="primaryButton"
          disabled={!vault || state.status === "loading"}
          onClick={() => void runPreview()}
          type="button"
        >
          Evaluate
        </button>
        <button
          className="secondaryButton"
          disabled={!vault || state.status === "loading"}
          onClick={() => void runPreview(POLICY_REJECT_PROPOSAL, "reject")}
          type="button"
        >
          Test policy reject
        </button>
      </div>

      <div className="agentPipeline" aria-label="Decision pipeline status">
        <span className="isComplete"><Check size={12} /> Schema</span>
        <i />
        <span className={evaluationDone ? "isComplete" : ""}>
          {state.status === "loading" ? <Clock3 size={12} /> : <Check size={12} />} Evaluation
        </span>
        <i />
        <span className={policyDone ? "isComplete" : ""}>
          <ShieldCheck size={12} /> Policy{policyStatus ? ` · ${policyStatus}` : ""}
        </span>
      </div>
    </section>
  );
}

function statusClass(state: PreviewState): string {
  if (state.status === "loading") return "isEvaluating";
  if (state.status === "unavailable") return "isUnavailable";
  if (state.status === "ready" && state.decision.policy.status === "rejected") return "isRejected";
  return "";
}

function statusLabel(state: PreviewState, hasVault: boolean): string {
  if (!hasVault) return "Waiting";
  if (state.status === "loading") return "Evaluating";
  if (state.status === "unavailable") return "Unavailable";
  if (state.status === "ready") return state.decision.policy.status === "accepted" ? "Accepted" : "Rejected";
  return "Ready";
}

function headingFor(state: PreviewState, hasVault: boolean): { title: string; body: string } {
  if (!hasVault) {
    return {
      title: "Waiting for an active vault.",
      body: "The first evaluation begins after a confirmed USDT deposit and an available policy snapshot.",
    };
  }
  if (state.status === "loading") {
    return {
      title: state.mode === "reject" ? "Checking an out-of-bounds proposal." : "Reading the vault snapshot.",
      body: "The agent is asking the decision service for a structured preview. This does not submit a transaction.",
    };
  }
  if (state.status === "unavailable") {
    return {
      title: "Preview unavailable.",
      body: state.message,
    };
  }
  if (state.status === "ready") {
    return {
      title: state.decision.policy.status === "accepted"
        ? "Policy accepted this preview."
        : "Policy rejected this preview.",
      body: state.decision.explanation,
    };
  }
  return {
    title: "Ready to evaluate.",
    body: "Evaluate uses the reserve-only baseline. Test policy reject sends a nonzero BDEX proposal so you can see policy.status rejected.",
  };
}
