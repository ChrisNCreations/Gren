import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DecisionResponse, ContractDecision } from "@gren/shared";

import { DecisionStore } from "./decisionStore.js";

const decision: ContractDecision = {
  decisionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
  vault: "0x0000000000000000000000000000000000000001",
  profile: 1,
  reserveBps: 10_000,
  dexBps: 0,
  slippageBps: 0,
  asset: "0x0000000000000000000000000000000000000002",
  strategy: "0x0000000000000000000000000000000000000003",
  reasonCode: "RESERVE_ONLY",
  inputHash: "0x0000000000000000000000000000000000000000000000000000000000000004",
  snapshotTotalAssets: "1000000",
  snapshotTotalShares: "1000000",
  snapshotReserveBps: 10_000,
  snapshotDexBps: 0,
  snapshotAt: 100,
  expiresAt: 400,
  policyVersion: "1",
};

const response: DecisionResponse = {
  decisionId: decision.decisionId,
  vault: decision.vault,
  profile: "balanced",
  allocation: { reserveBps: 10_000, dexBps: 0 },
  reasonCode: "RESERVE_ONLY",
  explanation: "Reserve-only test decision",
  inputHash: decision.inputHash,
  expiresAt: decision.expiresAt,
  policy: { status: "accepted", reasons: [] },
  execution: { status: "not_submitted", transactionHash: null, explorerUrl: null },
};

test("decision store persists validated decisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gren-agent-"));
  const path = join(directory, "decisions.json");
  const options = { maxRecords: 10, retentionMs: 10_000_000_000_000 };
  try {
    const first = new DecisionStore(path, options);
    await first.init();
    await first.put({ decision, response, createdAt: 123 });

    const second = new DecisionStore(path, options);
    await second.init();
    assert.deepEqual(await second.get(decision.decisionId), { decision, response, createdAt: 123 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
