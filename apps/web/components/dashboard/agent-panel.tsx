"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Clock3, ExternalLink, Play, ShieldCheck } from "lucide-react";
import { decisionResponseSchema, type DecisionResponse, type StructuredProposal } from "@gren/shared";

import {
  executeDecision,
  getDecision,
  policyRejectProposal,
  previewDecision,
  publicVaultAddress,
} from "@/lib/agent";
import type { ProfileId } from "@/lib/dashboard";

type PanelState =
  | { status: "idle" }
  | { status: "loading"; mode: "evaluate" | "reject" | "execute" }
  | { status: "ready"; decision: DecisionResponse }
  | { status: "unavailable"; message: string };

const TERMINAL_EXECUTION = new Set(["confirmed", "rejected_by_policy", "failed"]);

function decisionStorageKey(profileId: ProfileId): string {
  return `gren.agent.decision.${profileId}`;
}

function readStoredDecision(profileId: ProfileId): DecisionResponse | undefined {
  try {
    const raw = window.sessionStorage.getItem(decisionStorageKey(profileId));
    if (!raw) return undefined;
    return decisionResponseSchema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function storeDecision(profileId: ProfileId, decision: DecisionResponse): void {
  try {
    window.sessionStorage.setItem(decisionStorageKey(profileId), JSON.stringify(decision));
  } catch {
    // Ignore quota or private-mode failures; the live panel state remains authoritative.
  }
}

function shortenHash(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function pollExecution(decisionId: string, signal: AbortSignal): Promise<DecisionResponse> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const decision = await getDecision(decisionId);
    if (TERMINAL_EXECUTION.has(decision.execution.status)) return decision;
    await wait(2_000);
  }
  throw new Error("execution_timeout");
}

export function AgentPanel({
  profileId,
  onDecisionExecuted,
}: {
  profileId: ProfileId;
  onDecisionExecuted?: () => void;
}) {
  const vault = publicVaultAddress(profileId);
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const stored = readStoredDecision(profileId);
    setState(stored ? { status: "ready", decision: stored } : { status: "idle" });
  }, [profileId]);

  async function runPreview(proposal?: StructuredProposal, mode: "evaluate" | "reject" = "evaluate") {
    if (!vault) return;
    const current = requestId.current + 1;
    requestId.current = current;
    setState({ status: "loading", mode });
    try {
      const decision = await previewDecision({
        vault,
        profile: profileId,
        ...(proposal ? { proposal } : {}),
      });
      if (requestId.current !== current) return;
      storeDecision(profileId, decision);
      setState({ status: "ready", decision });
    } catch {
      if (requestId.current !== current) return;
      setState({
        status: "unavailable",
        message: "The decision service is unavailable. Withdrawals do not depend on this preview.",
      });
    }
  }

  async function runExecute() {
    if (state.status !== "ready" || state.decision.policy.status !== "accepted") return;
    const previous = state.decision;
    const decisionId = previous.decisionId;
    const current = requestId.current + 1;
    requestId.current = current;
    const controller = new AbortController();
    setState({ status: "loading", mode: "execute" });
    try {
      const submitted = await executeDecision(decisionId);
      const settled = TERMINAL_EXECUTION.has(submitted.execution.status)
        ? submitted
        : await pollExecution(decisionId, controller.signal);
      if (requestId.current !== current) return;
      storeDecision(profileId, settled);
      setState({ status: "ready", decision: settled });
      if (settled.execution.status === "confirmed" || settled.execution.status === "rejected_by_policy") {
        onDecisionExecuted?.();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestId.current !== current) return;
      const message = String(error);
      if (message.includes(":409")) {
        const failed = {
          ...previous,
          execution: { ...previous.execution, status: "failed" as const },
        };
        storeDecision(profileId, failed);
        setState({ status: "ready", decision: failed });
        return;
      }
      setState({
        status: "unavailable",
        message: "Keeper execution is unavailable. The vault still holds USDT and withdrawals do not depend on this action.",
      });
    }
  }

  const decision = state.status === "ready" ? state.decision : undefined;
  const policyStatus = decision?.policy.status;
  const executionStatus = decision?.execution.status;
  const heading = headingFor(state, Boolean(vault));
  const evaluationDone = state.status === "ready" || state.status === "unavailable";
  const policyDone = state.status === "ready";
  const canExecute = Boolean(vault && decision?.policy.status === "accepted" && executionStatus === "not_submitted");
  const executionDone = executionStatus === "confirmed"
    || executionStatus === "rejected_by_policy"
    || executionStatus === "failed"
    || executionStatus === "pending_confirmation";
  const busy = state.status === "loading";

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
              <dd data-testid="decision-policy-status">
                {decision.policy.status}
                {decision.policy.reasons[0] ? ` · ${decision.policy.reasons[0]}` : ""}
              </dd>
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
            <div>
              <dt>Execution</dt>
              <dd data-testid="decision-execution-status">{decision.execution.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd>
                {decision.execution.explorerUrl && decision.execution.transactionHash ? (
                  <a className="eventLink" href={decision.execution.explorerUrl} target="_blank" rel="noreferrer">
                    {shortenHash(decision.execution.transactionHash)} <ExternalLink size={12} />
                  </a>
                ) : (
                  "Not submitted"
                )}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="agentActions">
        <button
          className="primaryButton"
          disabled={!vault || busy}
          onClick={() => void runPreview()}
          type="button"
        >
          Evaluate
        </button>
        <button
          className="secondaryButton"
          disabled={!vault || busy}
          onClick={() => void runPreview(policyRejectProposal(profileId), "reject")}
          type="button"
        >
          Test policy reject
        </button>
        <button
          className="secondaryButton"
          data-testid="decision-execute"
          disabled={!canExecute || busy}
          onClick={() => void runExecute()}
          type="button"
        >
          <Play size={13} /> Execute
        </button>
      </div>

      <div className="agentPipeline" aria-label="Decision pipeline status">
        <span className="isComplete"><Check size={12} /> Schema</span>
        <i />
        <span className={evaluationDone ? "isComplete" : ""}>
          {state.status === "loading" && state.mode !== "execute" ? <Clock3 size={12} /> : <Check size={12} />} Evaluation
        </span>
        <i />
        <span className={policyDone ? "isComplete" : ""}>
          <ShieldCheck size={12} /> Policy{policyStatus ? ` · ${policyStatus}` : ""}
        </span>
        <i />
        <span className={executionDone ? "isComplete" : ""}>
          {state.status === "loading" && state.mode === "execute" ? <Clock3 size={12} /> : <Play size={12} />} Execution
        </span>
      </div>
    </section>
  );
}

function statusClass(state: PanelState): string {
  if (state.status === "loading") return "isEvaluating";
  if (state.status === "unavailable") return "isUnavailable";
  if (state.status === "ready" && state.decision.policy.status === "rejected") return "isRejected";
  if (state.status === "ready" && state.decision.execution.status === "confirmed") return "isConfirmed";
  if (state.status === "ready" && state.decision.execution.status === "failed") return "isRejected";
  return "";
}

function statusLabel(state: PanelState, hasVault: boolean): string {
  if (!hasVault) return "Waiting";
  if (state.status === "loading") {
    if (state.mode === "execute") return "Submitting";
    return "Evaluating";
  }
  if (state.status === "unavailable") return "Unavailable";
  if (state.status === "ready") {
    if (state.decision.execution.status === "confirmed") return "Executed";
    if (state.decision.execution.status === "pending_confirmation") return "Pending";
    if (state.decision.execution.status === "failed") return "Failed";
    return state.decision.policy.status === "accepted" ? "Accepted" : "Rejected";
  }
  return "Ready";
}

function headingFor(state: PanelState, hasVault: boolean): { title: string; body: string } {
  if (!hasVault) {
    return {
      title: "Waiting for an active vault.",
      body: "The first evaluation begins after a confirmed USDT deposit and an available policy snapshot.",
    };
  }
  if (state.status === "loading") {
    if (state.mode === "execute") {
      return {
        title: "Submitting the accepted decision.",
        body: "The restricted keeper is sending the structured payload. The browser never receives the keeper key.",
      };
    }
    return {
      title: state.mode === "reject" ? "Checking an out-of-bounds proposal." : "Reading the vault snapshot.",
      body: "The agent is asking the decision service for a structured preview. This does not submit a transaction.",
    };
  }
  if (state.status === "unavailable") {
    return {
      title: "Service unavailable.",
      body: state.message,
    };
  }
  if (state.status === "ready") {
    if (state.decision.execution.status === "confirmed") {
      return {
        title: "Keeper executed this decision.",
        body: state.decision.explanation,
      };
    }
    if (state.decision.execution.status === "rejected_by_policy") {
      return {
        title: "On-chain policy rejected execution.",
        body: state.decision.explanation,
      };
    }
    if (state.decision.execution.status === "failed") {
      return {
        title: "Execution did not complete.",
        body: "The keeper transaction failed or did not emit a decision event. Vault balances are unchanged.",
      };
    }
    return {
      title: state.decision.policy.status === "accepted"
        ? "Policy accepted this preview."
        : "Policy rejected this preview.",
      body: state.decision.explanation,
    };
  }
  return {
    title: "Ready to evaluate.",
    body: "Evaluate uses the reserve-only baseline except on the aggressive vault, which may propose constrained BDEX. Execute sends an accepted decision through the keeper. Test policy reject sends an out-of-bounds allocation so you can see policy.status rejected.",
  };
}
