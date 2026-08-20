import { test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "./config.js";

const baseEnv = {
  BOT_CHAIN_ID: "968",
  BOT_CHAIN_RPC_URL: "https://rpc.bohr.life",
  BOT_CHAIN_EXPLORER_URL: "https://scan.bohr.life",
  TESTNET_USDT_ADDRESS: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
  CONSERVATIVE_VAULT_ADDRESS: "0x0000000000000000000000000000000000000001",
  BALANCED_VAULT_ADDRESS: "0x0000000000000000000000000000000000000002",
  AGGRESSIVE_VAULT_ADDRESS: "0x0000000000000000000000000000000000000003",
  CONSERVATIVE_RESERVE_STRATEGY_ADDRESS: "0x0000000000000000000000000000000000000004",
  BALANCED_RESERVE_STRATEGY_ADDRESS: "0x0000000000000000000000000000000000000005",
  AGGRESSIVE_RESERVE_STRATEGY_ADDRESS: "0x0000000000000000000000000000000000000006",
  AGENT_API_KEY: "test-api-key-012345678901234567890123",
  KEEPER_PRIVATE_KEY: "0000000000000000000000000000000000000000000000000000000000000007",
  AGENT_ALLOWED_ORIGINS: "https://app.example.test",
  DECISION_STORE_BACKEND: "file",
  MODEL_BASE_URL: "https://api.groq.com/openai/v1",
} as const;

test("loadConfig accepts the bounded testnet configuration", () => {
  const config = loadConfig(baseEnv);
  assert.equal(config.chainId, 968);
  assert.deepEqual(config.allowedOrigins, ["https://app.example.test"]);
  assert.equal(config.decisionStoreBackend, "file");
});

test("loadConfig rejects untrusted model endpoints", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, MODEL_BASE_URL: "https://example.com/api" }),
    /MODEL_BASE_URL host is not allowlisted/,
  );
});

test("loadConfig requires Supabase credentials when selected", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, DECISION_STORE_BACKEND: "supabase" }),
    /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/,
  );
});

test("loadConfig accepts BOT Chain Mainnet when RPC, explorer, and USDT match", () => {
  const config = loadConfig({
    ...baseEnv,
    BOT_CHAIN_ID: "677",
    BOT_CHAIN_RPC_URL: "https://rpc.botchain.ai",
    BOT_CHAIN_EXPLORER_URL: "https://scan.botchain.ai",
    TESTNET_USDT_ADDRESS: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
    USDT_ADDRESS: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
  });
  assert.equal(config.chainId, 677);
  assert.equal(config.rpcUrl, "https://rpc.botchain.ai");
  assert.equal(config.usdtAddress.toLowerCase(), "0xababc7ddc03e501d190c676bf3d92ef0e6e87a3c");
});

test("loadConfig rejects mixed testnet and Mainnet configuration", () => {
  assert.throws(
    () => loadConfig({
      ...baseEnv,
      BOT_CHAIN_RPC_URL: "https://rpc.botchain.ai",
    }),
    /does not match BOT Chain Testnet/,
  );
  assert.throws(
    () => loadConfig({
      ...baseEnv,
      BOT_CHAIN_ID: "677",
      BOT_CHAIN_RPC_URL: "https://rpc.botchain.ai",
      BOT_CHAIN_EXPLORER_URL: "https://scan.botchain.ai",
    }),
    /does not match BOT Chain Mainnet/,
  );
});
