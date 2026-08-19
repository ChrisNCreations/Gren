import {
  decisionPreviewRequestSchema,
  decisionResponseSchema,
  type DecisionPreviewRequest,
  type DecisionResponse,
  type StructuredProposal,
} from "@gren/shared";

import type { ProfileId } from "@/lib/dashboard";
import { isSecureAgentUrl, publicChainConfig } from "@/lib/public-config";

const vaultEnv: Record<ProfileId, string | undefined> = {
  conservative: publicChainConfig.vaults.conservative,
  balanced: publicChainConfig.vaults.balanced,
  aggressive: publicChainConfig.vaults.aggressive,
};

export const POLICY_REJECT_PROPOSAL: StructuredProposal = {
  reserveBps: 0,
  dexBps: 10_000,
  slippageBps: 0,
  reasonCode: "BDEX_DISABLED",
};

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

export async function previewDecision(request: DecisionPreviewRequest): Promise<DecisionResponse> {
  const parsed = decisionPreviewRequestSchema.parse(request);
  const baseUrl = agentBaseUrl();
  if (!baseUrl) throw new Error("agent_not_configured");
  const response = await fetch(`${baseUrl}/v1/decisions/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  if (!response.ok) {
    throw new Error(`preview_unavailable:${response.status}`);
  }
  return decisionResponseSchema.parse(await response.json());
}
