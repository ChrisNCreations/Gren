import { timingSafeEqual } from "node:crypto";
import { cors } from "hono/cors";
import { Hono } from "hono";
import {
  decisionExecuteRequestSchema,
  decisionPreviewRequestSchema,
} from "@gren/shared";

import type { AgentConfig } from "./config.js";
import { DecisionService } from "./decisions/service.js";

function hasApiKey(value: string | undefined, expected: string): boolean {
  if (!value) return false;
  const supplied = Buffer.from(value.replace(/^Bearer\s+/i, ""));
  const required = Buffer.from(expected);
  return supplied.length === required.length && timingSafeEqual(supplied, required);
}

export function createApp(config: AgentConfig, service: DecisionService): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"] }));

  app.get("/health", (context) =>
    context.json({ service: "gren-agent", status: "ok", version: config.version }),
  );

  app.post("/v1/decisions/preview", async (context) => {
    try {
      const body = await context.req.json<unknown>();
      const parsed = decisionPreviewRequestSchema.safeParse(body);
      if (!parsed.success) {
        return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
      }
      return context.json(await service.preview(parsed.data), 200);
    } catch (error) {
      return context.json({ error: "preview_unavailable", message: String(error) }, 503);
    }
  });

  app.post("/v1/decisions/execute", async (context) => {
    if (!hasApiKey(context.req.header("Authorization"), config.apiKey)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    try {
      const body = await context.req.json<unknown>();
      const parsed = decisionExecuteRequestSchema.safeParse(body);
      if (!parsed.success) {
        return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
      }
      return context.json(await service.execute(parsed.data.decisionId), 200);
    } catch (error) {
      const message = String(error);
      const status = message.includes("not found") ? 404 : message.includes("Only") || message.includes("expired") ? 409 : 503;
      return context.json({ error: "execution_unavailable", message }, status);
    }
  });

  app.get("/v1/decisions/:decisionId", async (context) => {
    try {
      return context.json(await service.status(context.req.param("decisionId")), 200);
    } catch (error) {
      const message = String(error);
      return context.json(
        { error: message.includes("not found") ? "not_found" : "status_unavailable", message },
        message.includes("not found") ? 404 : 503,
      );
    }
  });

  return app;
}
