import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampProposal,
  fallbackProposal,
  ModelAdapter,
  parseModelProposal,
  selectPreviewProposal,
  type ModelContext,
} from "./model.js";
import { defaultProposal } from "./engine.js";

const context: ModelContext = {
  profile: "balanced",
  snapshot: {
    totalAssets: "1000000",
    totalShares: "1000000",
    reserveBps: 10_000,
    dexBps: 0,
    policyVersion: "1",
    observedAt: 100,
  },
  maxDexBps: 4_500,
  maxSlippageBps: 80,
  bdexEnabled: false,
};

test("parseModelProposal accepts a schema-valid payload", () => {
  const parsed = parseModelProposal({
    reserveBps: 10_000,
    dexBps: 0,
    slippageBps: 0,
    reasonCode: "RESERVE_ONLY",
    explanation: "Keep the balanced vault liquid while BDEX is disabled.",
  });
  assert.equal(parsed.reserveBps, 10_000);
  assert.match(parsed.explanation, /liquid/);
});

test("parseModelProposal rejects invalid allocations and extra fields that break totals", () => {
  assert.throws(() =>
    parseModelProposal({
      reserveBps: 4_000,
      dexBps: 4_000,
      slippageBps: 0,
      reasonCode: "RESERVE_ONLY",
      explanation: "totals do not add to 10000",
    }),
  );
});

test("clampProposal forces reserve-only when BDEX is disabled", () => {
  const clamped = clampProposal(
    { reserveBps: 3_000, dexBps: 7_000, slippageBps: 80, reasonCode: "DEX_EXPOSURE_EXCEEDED" },
    false,
  );
  assert.deepEqual(clamped, defaultProposal());
});

test("clampProposal leaves a valid proposal unchanged when BDEX is enabled", () => {
  const proposal = { reserveBps: 7_000, dexBps: 3_000, slippageBps: 40, reasonCode: "VOLATILITY_WITHIN_BAND" as const };
  assert.deepEqual(clampProposal(proposal, true), proposal);
});

test("adapter uses injected JSON and clamps nonzero dex while BDEX is off", async () => {
  const adapter = new ModelAdapter({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    timeoutMs: 1_000,
    complete: async () => ({
      reserveBps: 5_500,
      dexBps: 4_500,
      slippageBps: 80,
      reasonCode: "VOLATILITY_WITHIN_BAND",
      explanation: "Model wanted BDEX, but testnet policy keeps USDT in reserve. Snapshot assets 1000000.",
    }),
  });

  const proposal = await adapter.propose(context);
  assert.equal(proposal.reserveBps, 10_000);
  assert.equal(proposal.dexBps, 0);
  assert.equal(proposal.reasonCode, "RESERVE_ONLY");
  assert.match(proposal.explanation, /Model wanted BDEX/);
});

test("adapter falls back when the model times out or returns invalid JSON", async () => {
  const timeoutAdapter = new ModelAdapter({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    timeoutMs: 20,
    complete: () => new Promise(() => undefined),
  });
  const invalidAdapter = new ModelAdapter({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    timeoutMs: 1_000,
    complete: async () => ({ reserveBps: 1 }),
  });

  const timedOut = await timeoutAdapter.propose(context);
  const invalid = await invalidAdapter.propose(context);
  const expected = fallbackProposal(context);
  assert.deepEqual(timedOut, expected);
  assert.deepEqual(invalid, expected);
});

test("adapter stays deterministic when no model key is configured", async () => {
  const adapter = new ModelAdapter({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    timeoutMs: 1_000,
  });
  assert.deepEqual(await adapter.propose(context), fallbackProposal(context));
});

test("selectPreviewProposal uses a client proposal and otherwise asks the adapter", async () => {
  const adapter = new ModelAdapter({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    timeoutMs: 1_000,
    complete: async () => ({
      ...defaultProposal(),
      explanation: "Model explanation for the selected vault snapshot.",
    }),
  });

  const client = await selectPreviewProposal(
    {
      proposal: { reserveBps: 0, dexBps: 10_000, slippageBps: 0, reasonCode: "BDEX_DISABLED" },
    },
    context,
    adapter,
  );
  assert.equal(client.dexBps, 10_000);
  assert.equal(client.reasonCode, "BDEX_DISABLED");

  const generated = await selectPreviewProposal({}, context, adapter);
  assert.equal(generated.reasonCode, "RESERVE_ONLY");
  assert.match(generated.explanation, /Model explanation/);
});
