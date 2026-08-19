import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  contractDecisionSchema,
  decisionResponseSchema,
  type ContractDecision,
  type DecisionResponse,
} from "@gren/shared";

export type DecisionRecord = {
  decision: ContractDecision;
  response: DecisionResponse;
  createdAt: number;
};

export type DecisionStoreOptions = {
  maxRecords: number;
  retentionMs: number;
};

export interface DecisionStoreLike {
  init(): Promise<void>;
  put(record: DecisionRecord): Promise<void>;
  get(decisionId: string): Promise<DecisionRecord | undefined>;
  update(
    decisionId: string,
    update: (record: DecisionRecord) => DecisionRecord,
  ): Promise<DecisionRecord | undefined>;
}

const defaultOptions: DecisionStoreOptions = {
  maxRecords: 10_000,
  retentionMs: 7 * 24 * 60 * 60 * 1_000,
};

function optionsOrDefault(options?: Partial<DecisionStoreOptions>): DecisionStoreOptions {
  return {
    maxRecords: options?.maxRecords ?? defaultOptions.maxRecords,
    retentionMs: options?.retentionMs ?? defaultOptions.retentionMs,
  };
}

function parseRecord(value: unknown): DecisionRecord {
  if (!value || typeof value !== "object") throw new Error("invalid decision record");
  const record = value as Record<string, unknown>;
  const decision = contractDecisionSchema.parse(record.decision);
  const response = decisionResponseSchema.parse(record.response);
  const createdAt = Number(record.createdAt ?? record.created_at);
  if (!Number.isSafeInteger(createdAt) || createdAt <= 0) {
    throw new Error("invalid decision record timestamp");
  }
  return { decision, response, createdAt };
}

export class DecisionStore implements DecisionStoreLike {
  private readonly records = new Map<string, DecisionRecord>();
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly options: DecisionStoreOptions;

  public constructor(
    private readonly filePath: string,
    options?: Partial<DecisionStoreOptions>,
  ) {
    this.options = optionsOrDefault(options);
  }

  public async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed)) throw new Error("decision store must contain an array");
      for (const value of parsed) {
        try {
          const record = parseRecord(value);
          this.records.set(record.decision.decisionId, record);
        } catch {
          // Ignore malformed historical entries and keep valid decisions available.
        }
      }
      this.prune();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(`Unable to load decision store: ${String(error)}`);
      }
    }
  }

  public async put(record: DecisionRecord): Promise<void> {
    this.records.set(record.decision.decisionId, record);
    this.prune();
    await this.flush();
  }

  public async get(decisionId: string): Promise<DecisionRecord | undefined> {
    return this.records.get(decisionId);
  }

  public async update(
    decisionId: string,
    update: (record: DecisionRecord) => DecisionRecord,
  ): Promise<DecisionRecord | undefined> {
    const current = this.records.get(decisionId);
    if (!current) return undefined;
    const next = update(current);
    this.records.set(decisionId, next);
    this.prune();
    await this.flush();
    return next;
  }

  private prune(): void {
    const cutoff = Date.now() - this.options.retentionMs;
    for (const [decisionId, record] of this.records) {
      if (record.createdAt < cutoff) this.records.delete(decisionId);
    }

    while (this.records.size > this.options.maxRecords) {
      const oldest = [...this.records.entries()].sort((left, right) => left[1].createdAt - right[1].createdAt)[0];
      if (!oldest) break;
      this.records.delete(oldest[0]);
    }
  }

  private async flush(): Promise<void> {
    const write = async () => {
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(
        temporaryPath,
        JSON.stringify([...this.records.values()], null, 2),
        "utf8",
      );
      await rename(temporaryPath, this.filePath);
    };

    const queued = this.writeQueue.then(write);
    this.writeQueue = queued.catch(() => undefined);
    await queued;
  }
}

type SupabaseDecisionRow = {
  decision_id: string;
  decision: unknown;
  response: unknown;
  created_at: number;
};

export class SupabaseDecisionStore implements DecisionStoreLike {
  private readonly client: SupabaseClient;
  private readonly options: DecisionStoreOptions;

  public constructor(
    url: string,
    serviceRoleKey: string,
    options?: Partial<DecisionStoreOptions>,
  ) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    this.options = optionsOrDefault(options);
  }

  public async init(): Promise<void> {
    await this.cleanup();
  }

  public async put(record: DecisionRecord): Promise<void> {
    const { error } = await this.client.from("decision_records").upsert(
      {
        decision_id: record.decision.decisionId,
        decision: record.decision,
        response: record.response,
        created_at: record.createdAt,
      },
      { onConflict: "decision_id" },
    );
    if (error) throw new Error(`Unable to persist decision: ${error.message}`);
    await this.cleanup();
  }

  public async get(decisionId: string): Promise<DecisionRecord | undefined> {
    const { data, error } = await this.client
      .from("decision_records")
      .select("decision_id, decision, response, created_at")
      .eq("decision_id", decisionId)
      .maybeSingle();
    if (error) throw new Error(`Unable to read decision: ${error.message}`);
    return data ? parseRecord(data as SupabaseDecisionRow) : undefined;
  }

  public async update(
    decisionId: string,
    update: (record: DecisionRecord) => DecisionRecord,
  ): Promise<DecisionRecord | undefined> {
    const current = await this.get(decisionId);
    if (!current) return undefined;
    const next = update(current);
    const { data, error } = await this.client
      .from("decision_records")
      .update({ decision: next.decision, response: next.response })
      .eq("decision_id", decisionId)
      .select("decision_id, decision, response, created_at")
      .maybeSingle();
    if (error) throw new Error(`Unable to update decision: ${error.message}`);
    return data ? parseRecord(data as SupabaseDecisionRow) : undefined;
  }

  private async cleanup(): Promise<void> {
    const cutoff = Date.now() - this.options.retentionMs;
    const { error: retentionError } = await this.client
      .from("decision_records")
      .delete()
      .lt("created_at", cutoff);
    if (retentionError) throw new Error(`Unable to prune decisions: ${retentionError.message}`);

    const { count, error: countError } = await this.client
      .from("decision_records")
      .select("decision_id", { count: "exact", head: true });
    if (countError) throw new Error(`Unable to count decisions: ${countError.message}`);
    if (!count || count <= this.options.maxRecords) return;

    const excess = count - this.options.maxRecords;
    const { data, error: oldestError } = await this.client
      .from("decision_records")
      .select("decision_id")
      .order("created_at", { ascending: true })
      .limit(excess);
    if (oldestError) throw new Error(`Unable to select old decisions: ${oldestError.message}`);
    const ids = (data ?? [])
      .map((row) => (row as { decision_id?: unknown }).decision_id)
      .filter((value): value is string => typeof value === "string");
    if (ids.length === 0) return;

    const { error: deleteError } = await this.client
      .from("decision_records")
      .delete()
      .in("decision_id", ids);
    if (deleteError) throw new Error(`Unable to delete old decisions: ${deleteError.message}`);
  }
}
