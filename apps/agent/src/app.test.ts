import { test } from "node:test";
import assert from "node:assert/strict";
import type { Address } from "viem";
import type { DecisionResponse } from "@gren/shared";

import { createApp } from "./app.js";
import type { AgentConfig } from "./config.js";
import type { DecisionService } from "./decisions/service.js";

const response: DecisionResponse = {
  decisionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
  vault: "0x0000000000000000000000000000000000000001",
  profile: "balanced",
  allocation: { reserveBps: 10_000, dexBps: 0 },
  reasonCode: "RESERVE_ONLY",
  explanation: "Reserve-only test response",
  inputHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
  expiresAt: 500,
  policy: { status: "accepted", reasons: [] },
  execution: { status: "not_submitted", transactionHash: null, explorerUrl: null },
};

const config: AgentConfig = {
  port: 8787,
  version: "test",
  rpcUrl: "https://rpc.bohr.life",
  chainId: 968,
  explorerUrl: "https://scan.bohr.life",
  usdtAddress: "0x0000000000000000000000000000000000000002",
  vaults: {
    conservative: "0x0000000000000000000000000000000000000003",
    balanced: response.vault as Address,
    aggressive: "0x0000000000000000000000000000000000000004",
  },
  reserveStrategies: {
    conservative: "0x0000000000000000000000000000000000000005",
    balanced: "0x0000000000000000000000000000000000000006",
    aggressive: "0x0000000000000000000000000000000000000007",
  },
  apiKey: "test-api-key",
  keeperPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000008",
  decisionStorePath: ".agent/test.json",
  modelBaseUrl: "https://api.groq.com/openai/v1",
  modelApiKey: undefined,
  modelName: "openai/gpt-oss-20b",
  modelTimeoutMs: 8_000,
};

test("agent routes keep keeper authentication server-side", async () => {
  const service = {
    preview: async () => response,
    execute: async () => response,
    status: async () => response,
  } as unknown as DecisionService;
  const app = createApp(config, service);

  const health = await app.request("http://localhost/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { service: "gren-agent", status: "ok", version: "test" });

  const preview = await app.request("http://localhost/v1/decisions/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault: response.vault }),
  });
  assert.equal(preview.status, 200);

  const unauthorized = await app.request("http://localhost/v1/decisions/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisionId: response.decisionId }),
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await app.request("http://localhost/v1/decisions/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-api-key",
    },
    body: JSON.stringify({ decisionId: response.decisionId }),
  });
  assert.equal(authorized.status, 200);
});
