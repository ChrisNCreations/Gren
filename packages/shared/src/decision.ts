import { z } from "zod";

import { riskProfiles } from "./chain.js";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const uintStringSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const bpsSchema = z.number().int().min(0).max(10_000);

export const riskProfileSchema = z.enum(riskProfiles);

export const reasonCodeSchema = z.enum([
  "RESERVE_ONLY",
  "VOLATILITY_WITHIN_BAND",
  "BDEX_DISABLED",
  "VAULT_MISMATCH",
  "PROFILE_MISMATCH",
  "DECISION_REPLAYED",
  "DECISION_EXPIRED",
  "INPUT_STALE",
  "INPUT_HASH_MISMATCH",
  "ALLOCATION_TOTAL_INVALID",
  "DEX_EXPOSURE_EXCEEDED",
  "SLIPPAGE_EXCEEDED",
  "COOLDOWN_ACTIVE",
  "ASSET_NOT_ALLOWED",
  "STRATEGY_NOT_ALLOWED",
  "EXECUTION_PAUSED",
]);

export const policyStatusSchema = z.enum(["accepted", "rejected"]);

export const executionStatusSchema = z.enum([
  "not_submitted",
  "pending_confirmation",
  "confirmed",
  "rejected_by_policy",
  "failed",
  "unavailable",
]);

export const chainSnapshotSchema = z.object({
  totalAssets: uintStringSchema,
  totalShares: uintStringSchema,
  reserveBps: bpsSchema,
  dexBps: bpsSchema,
  policyVersion: uintStringSchema,
  observedAt: z.number().int().nonnegative(),
});

export const structuredProposalSchema = z
  .object({
    reserveBps: bpsSchema,
    dexBps: bpsSchema,
    slippageBps: bpsSchema,
    reasonCode: reasonCodeSchema,
  })
  .refine((proposal) => proposal.reserveBps + proposal.dexBps === 10_000, {
    message: "Allocation must total 10,000 basis points",
    path: ["reserveBps"],
  });

export const contractDecisionSchema = z
  .object({
    decisionId: bytes32Schema,
    vault: addressSchema,
    profile: z.number().int().min(0).max(2),
    reserveBps: bpsSchema,
    dexBps: bpsSchema,
    slippageBps: bpsSchema,
    asset: addressSchema,
    strategy: addressSchema,
    reasonCode: reasonCodeSchema,
    inputHash: bytes32Schema,
    snapshotTotalAssets: uintStringSchema,
    snapshotTotalShares: uintStringSchema,
    snapshotReserveBps: bpsSchema,
    snapshotDexBps: bpsSchema,
    snapshotAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    policyVersion: uintStringSchema,
  })
  .refine((decision) => decision.reserveBps + decision.dexBps === 10_000, {
    message: "Allocation must total 10,000 basis points",
    path: ["reserveBps"],
  });

export const decisionPreviewRequestSchema = z.object({
  vault: addressSchema,
  profile: riskProfileSchema.optional(),
  snapshot: chainSnapshotSchema.optional(),
  proposal: structuredProposalSchema.optional(),
});

export const decisionExecuteRequestSchema = z.object({
  decisionId: bytes32Schema,
});

export const decisionResponseSchema = z.object({
  decisionId: bytes32Schema,
  vault: addressSchema,
  profile: riskProfileSchema,
  allocation: z.object({ reserveBps: bpsSchema, dexBps: bpsSchema }),
  reasonCode: reasonCodeSchema,
  explanation: z.string().min(1).max(2_000),
  inputHash: bytes32Schema,
  expiresAt: z.number().int().positive(),
  policy: z.object({
    status: policyStatusSchema,
    reasons: z.array(z.string().min(1).max(200)),
  }),
  execution: z.object({
    status: executionStatusSchema,
    transactionHash: bytes32Schema.nullable(),
    explorerUrl: z.string().url().nullable(),
  }),
});

export type ReasonCode = z.infer<typeof reasonCodeSchema>;
export type ChainSnapshot = z.infer<typeof chainSnapshotSchema>;
export type StructuredProposal = z.infer<typeof structuredProposalSchema>;
export type ContractDecision = z.infer<typeof contractDecisionSchema>;
export type DecisionPreviewRequest = z.infer<typeof decisionPreviewRequestSchema>;
export type DecisionExecuteRequest = z.infer<typeof decisionExecuteRequestSchema>;
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
