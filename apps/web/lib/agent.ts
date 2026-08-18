import {
  decisionPreviewRequestSchema,
  decisionResponseSchema,
  type DecisionPreviewRequest,
  type DecisionResponse,
  type StructuredProposal,
} from "@gren/shared";

import type { ProfileId } from "@/lib/dashboard";

const vaultEnv: Record<ProfileId, string | undefined> = {
  conservative: process.env.NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS,
  balanced: process.env.NEXT_PUBLIC_BALANCED_VAULT_ADDRESS,
  aggressive: process.env.NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS,
};

export const POLICY_REJECT_PROPOSAL: StructuredProposal = {
  reserveBps: 0,
  dexBps: 10_000,
  slippageBps: 0,
  reasonCode: "BDEX_DISABLED",
};

export function agentBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8787").replace(/\/$/, "");
}

export function publicVaultAddress(profile: ProfileId): `0x${string}` | undefined {
  const value = vaultEnv[profile]?.trim();
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as `0x${string}`;
}

export async function previewDecision(request: DecisionPreviewRequest): Promise<DecisionResponse> {
  const parsed = decisionPreviewRequestSchema.parse(request);
  const response = await fetch(`${agentBaseUrl()}/v1/decisions/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  if (!response.ok) {
    throw new Error(`preview_unavailable:${response.status}`);
  }
  return decisionResponseSchema.parse(await response.json());
}
