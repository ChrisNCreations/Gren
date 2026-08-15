import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDecision } from "./engine.js";

test("deterministic engine emits a typed reserve-only proposal", () => {
  const decision = buildDecision(
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000003",
    "balanced",
    {
      totalAssets: "1000000",
      totalShares: "1000000",
      reserveBps: 10_000,
      dexBps: 0,
      policyVersion: "1",
      observedAt: 100,
    },
    undefined,
    100,
  );

  assert.match(decision.decisionId, /^0x[0-9a-f]{64}$/);
  assert.match(decision.inputHash, /^0x[0-9a-f]{64}$/);
  assert.equal(decision.profile, 1);
  assert.equal(decision.reserveBps, 10_000);
  assert.equal(decision.dexBps, 0);
  assert.equal(decision.expiresAt, 400);
});
