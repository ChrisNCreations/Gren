import { serve } from "@hono/node-server";
import { config as loadDotenv } from "dotenv";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChainClients, verifyDeployment } from "./chain/client.js";
import { DecisionService } from "./decisions/service.js";
import { DecisionStore, SupabaseDecisionStore, type DecisionStoreLike } from "./store/decisionStore.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const configuredDotenv = process.env.DOTENV_CONFIG_PATH;
const dotenvPath = configuredDotenv
  ? (isAbsolute(configuredDotenv) ? configuredDotenv : resolve(repoRoot, configuredDotenv))
  : resolve(repoRoot, ".env.local");
loadDotenv({ path: dotenvPath });
loadDotenv({ path: resolve(repoRoot, ".env") });

async function main(): Promise<void> {
  const config = loadConfig();
  const clients = createChainClients(config);
  await verifyDeployment(clients, config);

  const store: DecisionStoreLike = config.decisionStoreBackend === "supabase"
    ? new SupabaseDecisionStore(
        config.supabaseUrl as string,
        config.supabaseServiceRoleKey as string,
        { maxRecords: config.maxDecisionRecords, retentionMs: config.decisionRetentionMs },
      )
    : new DecisionStore(config.decisionStorePath, {
        maxRecords: config.maxDecisionRecords,
        retentionMs: config.decisionRetentionMs,
      });
  await store.init();
  const service = new DecisionService(config, clients, store);
  await service.verifyKeeper();

  const app = createApp(config, service);
  serve({ fetch: app.fetch, port: config.port });
  console.log(`Gren agent listening on http://localhost:${config.port}`);
}

main().catch((error: unknown) => {
  console.error(`Gren agent startup failed: ${String(error)}`);
  process.exitCode = 1;
});
