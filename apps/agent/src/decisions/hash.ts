import {
  encodeAbiParameters,
  hexToString,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import type { ChainSnapshot, ContractDecision } from "@gren/shared";
import type { GrenVaultDecision } from "@gren/shared";

export function reasonCodeToHex(reasonCode: ContractDecision["reasonCode"]): Hex {
  return stringToHex(reasonCode, { size: 32 });
}

export function reasonCodeFromHex(reasonCode: Hex): ContractDecision["reasonCode"] {
  if (reasonCode === "0x" || /^0x0+$/.test(reasonCode)) return "RESERVE_ONLY";
  const value = hexToString(reasonCode).replace(/\0+$/g, "");
  return value as ContractDecision["reasonCode"];
}

export function computeInputHash(
  vault: Address,
  profile: number,
  asset: Address,
  snapshot: ChainSnapshot,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint8" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
        { type: "uint16" },
        { type: "uint64" },
        { type: "uint64" },
      ],
      [
        vault,
        profile,
        asset,
        BigInt(snapshot.totalAssets),
        BigInt(snapshot.totalShares),
        snapshot.reserveBps,
        snapshot.dexBps,
        BigInt(snapshot.observedAt),
        BigInt(snapshot.policyVersion),
      ],
    ),
  );
}

export function toContractDecision(decision: ContractDecision): GrenVaultDecision {
  return {
    decisionId: decision.decisionId as `0x${string}`,
    vault: decision.vault as `0x${string}`,
    profile: decision.profile,
    reserveBps: decision.reserveBps,
    dexBps: decision.dexBps,
    slippageBps: decision.slippageBps,
    asset: decision.asset as `0x${string}`,
    strategy: decision.strategy as `0x${string}`,
    reasonCode: reasonCodeToHex(decision.reasonCode),
    inputHash: decision.inputHash as `0x${string}`,
    snapshotTotalAssets: BigInt(decision.snapshotTotalAssets),
    snapshotTotalShares: BigInt(decision.snapshotTotalShares),
    snapshotReserveBps: decision.snapshotReserveBps,
    snapshotDexBps: decision.snapshotDexBps,
    snapshotAt: decision.snapshotAt,
    expiresAt: decision.expiresAt,
    policyVersion: BigInt(decision.policyVersion),
  };
}
