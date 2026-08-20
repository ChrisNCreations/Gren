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
  decisionStoreBackend: "file",
  maxDecisionRecords: 100,
  decisionRetentionMs: 86_400_000,
  allowedOrigins: ["http://localhost:3000"],
  maxRequestBodyBytes: 64 * 1024,
  rateLimitWindowMs: 60_000,
  previewRateLimit: 30,
  statusRateLimit: 60,
  modelProvider: "openai-compatible",
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

test("agent allows origin-checked browser execute without exposing the API key", async () => {
  const service = {
    preview: async () => response,
    execute: async () => ({
      ...response,
      execution: {
        status: "pending_confirmation" as const,
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000003",
        explorerUrl: "https://scan.bohr.life/tx/0x0000000000000000000000000000000000000000000000000000000000000003",
      },
    }),
    status: async () => response,
  } as unknown as DecisionService;
  const app = createApp(config, service);

  const fromAllowedOrigin = await app.request("http://localhost/v1/decisions/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ decisionId: response.decisionId }),
  });
  assert.equal(fromAllowedOrigin.status, 200);
  assert.equal(fromAllowedOrigin.headers.get("access-control-allow-origin"), "http://localhost:3000");

  const fromUnknownOrigin = await app.request("http://localhost/v1/decisions/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ decisionId: response.decisionId }),
  });
  assert.equal(fromUnknownOrigin.status, 401);
});

test("agent restricts browser origins and request sizes", async () => {
  const service = {
    preview: async () => response,
    execute: async () => response,
    status: async () => response,
  } as unknown as DecisionService;
  const app = createApp(config, service);

  const allowed = await app.request("http://localhost/v1/decisions/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ vault: response.vault }),
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000");

  const denied = await app.request("http://localhost/v1/decisions/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ vault: response.vault }),
  });
  assert.equal(denied.status, 200);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);

  const oversized = await app.request("http://localhost/v1/decisions/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault: response.vault, padding: "x".repeat(config.maxRequestBodyBytes) }),
  });
  assert.equal(oversized.status, 413);
});
