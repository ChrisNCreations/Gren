import OpenAI from "openai";
import {
  botChainTestnet,
  profilePolicies,
  reasonCodeSchema,
  structuredProposalSchema,
  type ChainSnapshot,
  type RiskProfile,
  type StructuredProposal,
} from "@gren/shared";

import type { AgentConfig, ModelProvider } from "../config.js";
import { defaultProposal } from "./engine.js";

export type ModelContext = {
  profile: RiskProfile;
  snapshot: ChainSnapshot;
  maxDexBps: number;
  maxSlippageBps: number;
  bdexEnabled: boolean;
};

export type ModelProposal = StructuredProposal & { explanation: string };

export type ModelComplete = (context: ModelContext) => Promise<unknown>;

const reasonCodes = reasonCodeSchema.options;

const modelJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reserveBps", "dexBps", "slippageBps", "reasonCode", "explanation"],
  properties: {
    reserveBps: { type: "integer", minimum: 0, maximum: 10_000 },
    dexBps: { type: "integer", minimum: 0, maximum: 10_000 },
    slippageBps: { type: "integer", minimum: 0, maximum: 10_000 },
    reasonCode: { type: "string", enum: reasonCodes },
    explanation: { type: "string", minLength: 1, maxLength: 2_000 },
  },
} as const;

export function policyContext(profile: RiskProfile, snapshot: ChainSnapshot): ModelContext {
  return {
    profile,
    snapshot,
    ...profilePolicies[profile],
    bdexEnabled: botChainTestnet.bdexEnabled,
  };
}

export function fallbackExplanation(context: ModelContext): string {
  const { snapshot, profile } = context;
  if (snapshot.totalAssets === "0") {
    return `The ${profile} vault has no deposited assets yet. Keep the allocation at 10,000 reserve bps so the first deposit stays liquid in testnet USDT. BDEX execution is disabled.`;
  }
  return `Reserve-only policy keeps the ${profile} vault liquid in testnet USDT. Snapshot: ${snapshot.totalAssets} assets, ${snapshot.totalShares} shares, ${snapshot.reserveBps} reserve bps, ${snapshot.dexBps} dex bps, policy ${snapshot.policyVersion}. BDEX execution is disabled.`;
}

export function fallbackProposal(context: ModelContext): ModelProposal {
  return { ...defaultProposal(), explanation: fallbackExplanation(context) };
}

export function clampProposal(proposal: StructuredProposal, bdexEnabled: boolean): StructuredProposal {
  if (bdexEnabled) return proposal;
  return { ...defaultProposal(), reasonCode: "RESERVE_ONLY" };
}

export function parseModelProposal(value: unknown): ModelProposal {
  if (!value || typeof value !== "object") throw new Error("invalid_model_proposal");
  const record = value as Record<string, unknown>;
  const proposal = structuredProposalSchema.parse({
    reserveBps: record.reserveBps,
    dexBps: record.dexBps,
    slippageBps: record.slippageBps,
    reasonCode: record.reasonCode,
  });
  if (typeof record.explanation !== "string" || record.explanation.length < 1 || record.explanation.length > 2_000) {
    throw new Error("invalid_model_explanation");
  }
  return { ...proposal, explanation: record.explanation };
}

export async function selectPreviewProposal(
  request: { proposal?: StructuredProposal },
  context: ModelContext,
  adapter: ModelAdapter,
): Promise<ModelProposal> {
  if (request.proposal) {
    return {
      ...request.proposal,
      explanation: `Client-supplied proposal ${request.proposal.reasonCode}.`,
    };
  }
  return adapter.propose(context);
}

export class ModelAdapter {
  public constructor(
    private readonly options: {
      apiKey?: string;
      provider?: ModelProvider;
      baseUrl: string;
      model: string;
      timeoutMs: number;
      complete?: ModelComplete;
    },
  ) {}

  public static fromConfig(config: AgentConfig): ModelAdapter {
    return new ModelAdapter({
      apiKey: config.modelApiKey,
      provider: config.modelProvider,
      baseUrl: config.modelBaseUrl,
      model: config.modelName,
      timeoutMs: config.modelTimeoutMs,
    });
  }

  public async propose(context: ModelContext): Promise<ModelProposal> {
    if (!this.options.complete && !this.options.apiKey) return fallbackProposal(context);

    try {
      const raw = await withTimeout(
        this.options.complete
          ? this.options.complete(context)
          : this.options.provider === "gemini"
            ? this.callGemini(context)
            : this.callProvider(context),
        this.options.timeoutMs,
      );
      const parsed = parseModelProposal(raw);
      return {
        ...clampProposal(parsed, context.bdexEnabled),
        explanation: parsed.explanation,
      };
    } catch {
      return fallbackProposal(context);
    }
  }

  private async callProvider(context: ModelContext): Promise<unknown> {
    const client = new OpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      timeout: this.options.timeoutMs,
    });
    const completion = await client.chat.completions.create({
      model: this.options.model,
      messages: [
        { role: "system", content: systemPrompt(context) },
        { role: "user", content: JSON.stringify(context) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "gren_decision_proposal",
          strict: true,
          schema: modelJsonSchema,
        },
      },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("model_empty");
    return JSON.parse(content) as unknown;
  }

  private async callGemini(context: ModelContext): Promise<unknown> {
    if (!this.options.apiKey) throw new Error("gemini_api_key_missing");

    const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(this.options.model)}:generateContent?key=${encodeURIComponent(this.options.apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(context) }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: geminiJsonSchema,
          },
        }),
      });
      if (!response.ok) throw new Error(`gemini_http_${response.status}`);
      const body = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
      };
      const content = body.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part.text === "string",
      )?.text;
      if (typeof content !== "string" || content.length === 0) throw new Error("gemini_empty");
      return JSON.parse(content) as unknown;
    } finally {
      clearTimeout(timeout);
    }
  }
}

const geminiJsonSchema = {
  type: "OBJECT",
  properties: {
    reserveBps: { type: "INTEGER" },
    dexBps: { type: "INTEGER" },
    slippageBps: { type: "INTEGER" },
    reasonCode: { type: "STRING", enum: reasonCodes },
    explanation: { type: "STRING" },
  },
  required: ["reserveBps", "dexBps", "slippageBps", "reasonCode", "explanation"],
} as const;

function systemPrompt(context: ModelContext): string {
  return [
    "You are the Gren decision model. Propose structured allocation data only. Never invent calldata, targets, routers, yields, prices, or Mainnet liquidity.",
    "reserveBps + dexBps must equal 10000.",
    context.bdexEnabled
      ? `Stay within maxDexBps ${context.maxDexBps} and maxSlippageBps ${context.maxSlippageBps}.`
      : "BDEX is disabled. Set dexBps to 0, slippageBps to 0, and reasonCode to RESERVE_ONLY.",
    "Explanation must cite snapshot totals, current allocation, policy version, and why this profile stays liquid. 1-2000 characters.",
    "If totalAssets is 0, still return reserve-only and say the vault is waiting for a deposit.",
  ].join(" ");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("model_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
