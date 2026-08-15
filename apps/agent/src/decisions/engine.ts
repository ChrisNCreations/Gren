import { randomBytes } from "node:crypto";
import { getAddress, toHex, type Address } from "viem";
import {
  contractDecisionSchema,
  profileIndexes,
  type ChainSnapshot,
  type ContractDecision,
  type RiskProfile,
  type StructuredProposal,
} from "@gren/shared";

import { computeInputHash } from "./hash.js";

const DEFAULT_PROPOSAL: StructuredProposal = {
  reserveBps: 10_000,
  dexBps: 0,
  slippageBps: 0,
  reasonCode: "RESERVE_ONLY",
};

export function buildDecision(
  vault: Address,
  asset: Address,
  strategy: Address,
  profile: RiskProfile,
  snapshot: ChainSnapshot,
  proposal: StructuredProposal = DEFAULT_PROPOSAL,
  now = snapshot.observedAt,
): ContractDecision {
  const profileIndex = profileIndexes[profile];
  const decisionId = toHex(randomBytes(32)) as `0x${string}`;
  const inputHash = computeInputHash(vault, profileIndex, asset, snapshot);

  return contractDecisionSchema.parse({
    decisionId,
    vault: getAddress(vault),
    profile: profileIndex,
    reserveBps: proposal.reserveBps,
    dexBps: proposal.dexBps,
    slippageBps: proposal.slippageBps,
    asset: getAddress(asset),
    strategy: getAddress(strategy),
    reasonCode: proposal.reasonCode,
    inputHash,
    snapshotTotalAssets: snapshot.totalAssets,
    snapshotTotalShares: snapshot.totalShares,
    snapshotReserveBps: snapshot.reserveBps,
    snapshotDexBps: snapshot.dexBps,
    snapshotAt: snapshot.observedAt,
    expiresAt: now + 300,
    policyVersion: snapshot.policyVersion,
  });
}

export function defaultProposal(): StructuredProposal {
  return { ...DEFAULT_PROPOSAL };
}
