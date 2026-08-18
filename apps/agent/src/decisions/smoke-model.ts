import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

import { fallbackExplanation, ModelAdapter, policyContext } from "./model.js";

const envFiles = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../../.env.local"),
];
for (const path of envFiles) {
  loadDotenv({ path });
}

const snapshot = {
  totalAssets: "0",
  totalShares: "0",
  reserveBps: 10_000,
  dexBps: 0,
  policyVersion: "1",
  observedAt: Math.floor(Date.now() / 1_000),
};

async function main(): Promise<void> {
  const apiKey = process.env.MODEL_API_KEY?.trim()
    || process.env.GEMINI_API_KEY?.trim()
    || process.env.GROQ_API_KEY?.trim()
    || process.env.OPENROUTER_API_KEY?.trim()
    || process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("MODEL_API_KEY is missing. Add it to .env.local and retry.");
    process.exitCode = 1;
    return;
  }

  const context = policyContext("balanced", snapshot);
  const adapter = new ModelAdapter({
    apiKey,
    provider: process.env.MODEL_PROVIDER?.trim().toLowerCase() === "gemini" ? "gemini" : "openai-compatible",
    baseUrl: process.env.MODEL_BASE_URL?.trim()
      || (process.env.MODEL_PROVIDER?.trim().toLowerCase() === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "https://api.groq.com/openai/v1"),
    model: process.env.MODEL_NAME?.trim()
      || (process.env.MODEL_PROVIDER?.trim().toLowerCase() === "gemini" ? "gemini-2.0-flash" : "openai/gpt-oss-20b"),
    timeoutMs: Number(process.env.MODEL_TIMEOUT_MS ?? 8_000),
  });

  const proposal = await adapter.propose(context);
  const usedFallback = proposal.explanation === fallbackExplanation(context);
  console.log(`source=${usedFallback ? "fallback" : "model"}`);
  console.log(`reasonCode=${proposal.reasonCode}`);
  console.log(`allocation=${proposal.reserveBps}/${proposal.dexBps}`);
  console.log(`explanation=${proposal.explanation}`);
  if (usedFallback) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`smoke-model failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
