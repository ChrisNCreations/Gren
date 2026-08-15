import { serve } from "@hono/node-server";
import { config as loadDotenv } from "dotenv";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChainClients, verifyTestnet } from "./chain/client.js";
import { DecisionService } from "./decisions/service.js";
import { DecisionStore } from "./store/decisionStore.js";

loadDotenv({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local" });
loadDotenv({ path: ".env" });

async function main(): Promise<void> {
  const config = loadConfig();
  const clients = createChainClients(config);
  await verifyTestnet(clients, config);

  const store = new DecisionStore(config.decisionStorePath);
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
