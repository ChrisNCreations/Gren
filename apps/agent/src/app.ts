import { timingSafeEqual } from "node:crypto";
import { cors } from "hono/cors";
import { Hono, type Context } from "hono";
import {
  decisionExecuteRequestSchema,
  decisionPreviewRequestSchema,
} from "@gren/shared";

import type { AgentConfig } from "./config.js";
import { DecisionService } from "./decisions/service.js";

function hasApiKey(value: string | undefined, expected: string): boolean {
  if (!value) return false;
  const supplied = Buffer.from(value.replace(/^Bearer\s+/i, "").trim());
  const required = Buffer.from(expected);
  return supplied.length === required.length && timingSafeEqual(supplied, required);
}

class RequestBodyTooLargeError extends Error {
  public constructor() {
    super("request_body_too_large");
  }
}

class RequestBodyInvalidError extends Error {
  public constructor() {
    super("invalid_request_body");
  }
}

class WindowRateLimiter {
  private readonly requests = new Map<string, { startedAt: number; count: number }>();

  public constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  public allow(key: string): boolean {
    const now = Date.now();
    const current = this.requests.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.requests.set(key, { startedAt: now, count: 1 });
      this.prune(now);
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }

  private prune(now: number): void {
    if (this.requests.size < 1_000) return;
    for (const [key, value] of this.requests) {
      if (now - value.startedAt >= this.windowMs) this.requests.delete(key);
    }
  }
}

function clientKey(context: Context): string {
  const forwarded = context.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || context.req.header("x-real-ip") || "unknown";
}

async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) throw new RequestBodyInvalidError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new RequestBodyInvalidError();
  }
}

function requestErrorResponse(context: Context, error: unknown) {
  if (error instanceof RequestBodyTooLargeError) {
    return context.json({ error: "request_too_large" }, 413);
  }
  if (error instanceof RequestBodyInvalidError) {
    return context.json({ error: "invalid_request" }, 400);
  }
  return undefined;
}

export function createApp(config: AgentConfig, service: DecisionService): Hono {
  const app = new Hono();
  const previewLimiter = new WindowRateLimiter(config.previewRateLimit, config.rateLimitWindowMs);
  const statusLimiter = new WindowRateLimiter(config.statusRateLimit, config.rateLimitWindowMs);
  const executeLimiter = new WindowRateLimiter(10, config.rateLimitWindowMs);

  app.use("*", cors({
    origin: (origin) => config.allowedOrigins.includes(origin) ? origin : undefined,
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  app.get("/health", (context) =>
    context.json({ service: "gren-agent", status: "ok", version: config.version }),
  );

  app.post("/v1/decisions/preview", async (context) => {
    if (!previewLimiter.allow(clientKey(context))) {
      return context.json({ error: "rate_limited" }, 429);
    }
    try {
      const body = await readJsonBody(context.req.raw, config.maxRequestBodyBytes);
      const parsed = decisionPreviewRequestSchema.safeParse(body);
      if (!parsed.success) {
        return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
      }
      return context.json(await service.preview(parsed.data), 200);
    } catch (error) {
      const requestError = requestErrorResponse(context, error);
      if (requestError) return requestError;
      console.error("Gren preview failed", error);
      return context.json({ error: "preview_unavailable" }, 503);
    }
  });

  app.post("/v1/decisions/execute", async (context) => {
    if (!hasApiKey(context.req.header("Authorization"), config.apiKey)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    if (!executeLimiter.allow(clientKey(context))) {
      return context.json({ error: "rate_limited" }, 429);
    }
    try {
      const body = await readJsonBody(context.req.raw, config.maxRequestBodyBytes);
      const parsed = decisionExecuteRequestSchema.safeParse(body);
      if (!parsed.success) {
        return context.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
      }
      return context.json(await service.execute(parsed.data.decisionId), 200);
    } catch (error) {
      const message = String(error);
      const status = message.includes("not found") ? 404 : message.includes("Only") || message.includes("expired") ? 409 : 503;
      console.error("Gren execution failed", error);
      return context.json({ error: status === 404 ? "not_found" : status === 409 ? "execution_rejected" : "execution_unavailable" }, status);
    }
  });

  app.get("/v1/decisions/:decisionId", async (context) => {
    if (!statusLimiter.allow(clientKey(context))) {
      return context.json({ error: "rate_limited" }, 429);
    }
    try {
      return context.json(await service.status(context.req.param("decisionId")), 200);
    } catch (error) {
      const message = String(error);
      console.error("Gren status failed", error);
      return context.json(
        { error: message.includes("not found") ? "not_found" : "status_unavailable" },
        message.includes("not found") ? 404 : 503,
      );
    }
  });

  return app;
}
