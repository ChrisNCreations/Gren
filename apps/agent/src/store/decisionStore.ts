import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

export class DecisionStore {
  private readonly records = new Map<string, DecisionRecord>();
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string) {}

  public async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed)) throw new Error("decision store must contain an array");
      for (const value of parsed) {
        if (!value || typeof value !== "object") continue;
        const record = value as Record<string, unknown>;
        const decision = contractDecisionSchema.parse(record.decision);
        const response = decisionResponseSchema.parse(record.response);
        const createdAt = Number(record.createdAt);
        if (!Number.isSafeInteger(createdAt)) continue;
        this.records.set(decision.decisionId, { decision, response, createdAt });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(`Unable to load decision store: ${String(error)}`);
      }
    }
  }

  public async put(record: DecisionRecord): Promise<void> {
    this.records.set(record.decision.decisionId, record);
    await this.flush();
  }

  public get(decisionId: string): DecisionRecord | undefined {
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
    await this.flush();
    return next;
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
