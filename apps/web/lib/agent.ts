import {
  decisionExecuteRequestSchema,
  decisionPreviewRequestSchema,
  decisionResponseSchema,
  type DecisionPreviewRequest,
  type DecisionResponse,
  type StructuredProposal,
} from "@gren/shared";
import type { Address } from "viem";

import type { ProfileId } from "@/lib/dashboard";
import { isSecureAgentUrl, publicChainConfig } from "@/lib/public-config";

const vaultEnv: Record<ProfileId, string | undefined> = {
  conservative: publicChainConfig.vaults.conservative,
  balanced: publicChainConfig.vaults.balanced,
  aggressive: publicChainConfig.vaults.aggressive,
};

export const POLICY_REJECT_PROPOSAL: StructuredProposal = {
  reserveBps: 9_999,
  dexBps: 1,
  slippageBps: 0,
  reasonCode: "BDEX_DISABLED",
};

export function policyRejectProposal(profile: ProfileId): StructuredProposal {
  if (profile === "aggressive") {
    return {
      reserveBps: 2_999,
      dexBps: 7_001,
      slippageBps: 120,
      reasonCode: "DEX_EXPOSURE_EXCEEDED",
    };
  }
  return POLICY_REJECT_PROPOSAL;
}

export function agentBaseUrl(): string | undefined {
  const value = publicChainConfig.agentUrl;
  if (!value || !isSecureAgentUrl(value)) return undefined;
  return value.replace(/\/$/, "");
}

export function publicVaultAddress(profile: ProfileId): `0x${string}` | undefined {
  const value = vaultEnv[profile]?.trim();
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as `0x${string}`;
}

export function publicVaultEntries(): { profileId: ProfileId; address: Address }[] {
  return (Object.keys(vaultEnv) as ProfileId[])
    .map((profileId) => {
      const address = publicVaultAddress(profileId);
      return address ? { profileId, address } : null;
    })
    .filter((entry): entry is { profileId: ProfileId; address: Address } => entry !== null);
}

async function readDecisionResponse(response: Response, fallback: string): Promise<DecisionResponse> {
  if (!response.ok) {
    throw new Error(`${fallback}:${response.status}`);
  }
  return decisionResponseSchema.parse(await response.json());
}

export async function previewDecision(request: DecisionPreviewRequest): Promise<DecisionResponse> {
  const parsed = decisionPreviewRequestSchema.parse(request);
  const baseUrl = agentBaseUrl();
  if (!baseUrl) throw new Error("agent_not_configured");
  const response = await fetch(`${baseUrl}/v1/decisions/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  return readDecisionResponse(response, "preview_unavailable");
}

export async function executeDecision(decisionId: string): Promise<DecisionResponse> {
  const parsed = decisionExecuteRequestSchema.parse({ decisionId });
  const baseUrl = agentBaseUrl();
  if (!baseUrl) throw new Error("agent_not_configured");
  const response = await fetch(`${baseUrl}/v1/decisions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  return readDecisionResponse(response, "execution_unavailable");
}

export async function getDecision(decisionId: string): Promise<DecisionResponse> {
  const baseUrl = agentBaseUrl();
  if (!baseUrl) throw new Error("agent_not_configured");
  const response = await fetch(`${baseUrl}/v1/decisions/${decisionId}`);
  return readDecisionResponse(response, "status_unavailable");
}
